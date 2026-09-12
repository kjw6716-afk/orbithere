#!/usr/bin/env python3
"""Prepare Korean headline drafts using an offline CPU model; never auto-publish.

Only the model is downloaded. Public headlines are processed locally, never sent
to a translation API. Inference failures leave official titles readable.
"""
import argparse
import json
from pathlib import Path
import sys
from update_news import valid_translation, valid_draft, DRAFT_FIELDS

MODEL = 'facebook/m2m100_418M'
REVISION = '55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636'

def pending(data):
    return [item for item in data.get('items', [])
            if item.get('language') == 'en' and not valid_translation(item)
            and not valid_draft(item)][:16]

def model_translator():
    import torch
    from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer
    torch.set_num_threads(2)
    tokenizer = M2M100Tokenizer.from_pretrained(MODEL, revision=REVISION, src_lang="en")
    model = M2M100ForConditionalGeneration.from_pretrained(MODEL, revision=REVISION, use_safetensors=False)
    model.eval()
    def translate(title):
        inputs = tokenizer(title, return_tensors='pt', truncation=True, max_length=256)
        with torch.inference_mode():
            output = model.generate(**inputs, forced_bos_token_id=tokenizer.get_lang_id("ko"), max_new_tokens=128, num_beams=4, do_sample=False)
        return tokenizer.decode(output[0], skip_special_tokens=True).strip()
    return translate

def translate_items(data, translate):
    count = 0
    for item in pending(data):
        try:
            candidate = dict(item, titleKoDraft=translate(item['title']),
                             titleKoDraftOriginal=item['title'],
                             titleKoDraftModel=f'{MODEL}@{REVISION}')
            if not valid_draft(candidate):
                raise ValueError('Invalid Korean translation')
            item.update(candidate)
            count += 1
        except Exception as error:
            print(f"Translation skipped ({item.get('id', '')}): {type(error).__name__}", file=sys.stderr)
    return count

def approve_title(data, article_id, title):
    item = next((i for i in data['items'] if i.get('id') == article_id), None)
    if not item:
        raise ValueError('Article ID not found')
    candidate = dict(item, titleKo=title, titleKoOriginal=item['title'], titleKoMethod='reviewed')
    if not valid_translation(candidate):
        raise ValueError('Invalid reviewed Korean title')
    for key in (*DRAFT_FIELDS, 'titleKoModel'):
        candidate.pop(key, None)
    item.clear()
    item.update(candidate)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data/news.json')
    parser.add_argument('--pending', action='store_true', help='Print count without loading model dependencies')
    parser.add_argument('--approve', metavar='ARTICLE_ID', help='Publish a title after checking it against the original')
    parser.add_argument('--title', help='The reviewed Korean title; required with --approve')
    args = parser.parse_args()
    data = json.loads(args.output.read_text())
    if args.approve:
        if not args.title:
            parser.error('--approve requires --title')
        approve_title(data, args.approve, args.title)
        temp = args.output.with_suffix('.tmp')
        temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        temp.replace(args.output)
        return 0
    remaining = pending(data)
    if args.pending:
        print(len(remaining))
        return 0
    if not remaining:
        print('All English headlines already have a reviewed title or a draft.')
        return 0
    try:
        translate = model_translator()
    except Exception as error:
        print(f'Translator unavailable: {type(error).__name__}; official titles preserved.', file=sys.stderr)
        return 1
    count = translate_items(data, translate)
    if count:
        temp = args.output.with_suffix('.tmp')
        temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        temp.replace(args.output)
    print(f'Cached {count}/{len(remaining)} Korean drafts for review; none auto-published.')
    return 0 if count == len(remaining) else 1

if __name__ == '__main__':
    raise SystemExit(main())
