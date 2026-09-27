import assert from 'node:assert/strict';

// Uses the real SDK and the community suite's HTTP fixtures. No live writes.
export async function boardDetailEditRegressions({fixture,base,A,B,P,uid,now,ok}) {
  async function open(f, embedded) {
    await f.page.goto(base + (embedded ? '/main.html#lounge' : '/lounge.html'));
    if (!embedded) return f.page;
    await f.page.frameLocator('#loungeFrame').locator('#boardTitle').waitFor();
    return f.page.frames().find(frame => new URL(frame.url()).pathname === '/lounge.html');
  }
  async function detail(board, id=P) {
    await board.locator('#post-' + id + ' .row-title').click();
    await board.locator('.detail-title').waitFor();
    await board.locator('#commentInput:enabled').waitFor();
  }
  async function back(f, board, embedded) {
    const menu=f.page.locator('#navToggle');
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded')!=='true') await menu.click();
    await f.page.locator(embedded ? '#sideNav .nav-item[data-panel="lounge"]' : '#sideNav .nav-item[aria-current="page"]').click();
  }
  async function switchAccount(f, board, embedded, actor) {
    await f.page.locator(embedded ? '#profileChip' : '[data-account-link]').click();
    await f.page.locator('#signOut').click();
    await f.page.locator('#authCard').waitFor();
    f.state.loginUserId=actor;
    await f.page.locator('#email').fill(actor===B ? 'b@example.test' : 'a@example.test');
    await f.page.locator('#password').fill('isolated-password');
    await f.page.locator('#authSubmit').click();
    await f.page.locator('#profileCard').waitFor();
    await board.waitForFunction(actor=>window.OrbitMembers.state.user?.id===actor && !!window.OrbitMembers.state.profile,actor);
    await f.page.locator('.account-close').click();
  }
  async function search(board, term) {
    await board.locator('#searchInput').fill(term);
    await board.locator('#feedSearch').evaluate(form=>form.requestSubmit());
    await board.waitForFunction(term=>new URL(location.href).searchParams.get('q')===term,term);
    await board.locator('#postList[aria-busy=false]').waitFor();
  }
  for (const embedded of [false,true]) {
    const mode=embedded?'iframe':'direct';
    {
      const f=await fixture();
      let release;
      const wait=new Promise(resolve=>{release=resolve;}), pending=[];
      const matches=req=>req.method()==='POST' &&
        new URL(req.url()).pathname.endsWith('/rpc/board_posts') && req.postDataJSON().p_pinned===false;
      // Auth initialization can start the list more than once. Hold every
      // initial response, then fall through to the existing SDK fixture.
      const holdList=async route=>{
        let finish;
        if (matches(route.request())) {
          pending.push(new Promise(resolve=>{finish=resolve;}));
          await wait;
        }
        try { await route.fallback(); } finally { if (finish) finish(); }
      };
      await f.context.route('**/rpc/board_posts',holdList);
      const initialRequest=f.page.waitForRequest(matches);
      try {
        const board=await open(f,embedded);
        await initialRequest;
        await board.locator('#postList[aria-busy=true]').waitFor();
        assert.equal(await board.locator('#post-'+P).count(),0,'initial list is still awaiting its response');
        await board.evaluate(()=>{window.__boardDocument=crypto.randomUUID();});
        const documentID=await board.evaluate(()=>window.__boardDocument);
        await board.locator('#writeTop').click();
        await board.locator('#postTitle').fill('목록을 기다리며 쓴 초안');
        await board.locator('#postInput').fill('목록으로 돌아와도 보관할 초안 본문');
        await board.locator('#cancelWrite').click();
        release();
        await Promise.all(pending);
        await board.locator('#post-'+P+' .row-title').waitFor();
        ok(`${mode}: leaving an initial loading list returns to its rows without a refresh`,
          await board.evaluate(()=>window.__boardDocument)===documentID);
        await board.locator('#writeTop').click();
        ok(`${mode}: returning from a loading list preserves the new-post draft`,
          await board.locator('#postTitle').inputValue()==='목록을 기다리며 쓴 초안' &&
          await board.locator('#postInput').inputValue()==='목록으로 돌아와도 보관할 초안 본문');
      } finally {
        release();
        await f.context.unroute('**/rpc/board_posts',holdList);
        await Promise.all(pending);
        await f.close();
      }
    }
    for (const width of [1440,360]) {
      const f=await fixture(),{page,state}=f;
      await page.setViewportSize({width,height:900});
      state.posts[0].author_id=A;
      state.posts[0].orbit='ask';
      state.posts.push(...[1,3].map((n,i)=>({...state.posts[0],id:uid(700+i),title:'사진 관측 '+n,
        image_paths:Array.from({length:n},(_,j)=>A+'/'+uid(700+i)+'/'+uid(j)+'.jpg')})));
      const board=await open(f,embedded);
      await board.locator('#post-' + P).waitFor();
      ok(`${mode}/${width}: absent, single and multiple photos use unobtrusive SVG counts`,
        await board.locator('#post-'+P+' .row-photo-count').count()===0 &&
        await board.locator('#post-'+uid(700)+' .row-photo-count').innerText().then(t=>t.trim()==='1') &&
        await board.locator('#post-'+uid(701)+' .row-photo-count').innerText().then(t=>t.trim()==='3') &&
        await board.locator('.row-photo-count svg').count()===2 && await board.locator('#postList img').count()===0);
      ok(`${mode}/${width}: list never fetches thumbnails or originals`,!state.requestLog.some(r=>r.path.startsWith('/storage/')));
      await board.evaluate(()=>{window.__boardDocument=crypto.randomUUID();});
      const documentID=await board.evaluate(()=>window.__boardDocument);
      for(const scope of ['all','category','search','activity']) {
        if(scope==='category') await board.locator('#questionFilter').check();
        if(scope==='search') await search(board,'기존');
        if(scope==='activity') await board.locator('#activityLink').click();
        await board.locator('#post-'+P).waitFor();
        const before=new URL(board.url());
        await detail(board);
        await back(f,board,embedded);
        await board.locator('#post-'+P).waitFor();
        const after=new URL(board.url());
        ok(`${mode}/${width}: ${scope} detail returns with category, search and activity retained`,
          !after.searchParams.has('post') && (before.hash||'#all')===(after.hash||'#all') &&
          before.searchParams.get('q')===after.searchParams.get('q') &&
          before.searchParams.get('activity')===after.searchParams.get('activity') &&
          await board.evaluate(()=>window.__boardDocument)===documentID);
      }
      await detail(board);
      await board.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});});
      const share=board.locator('[data-action=share]');
      await share.click();
      await board.locator('#loungeStatus').filter({hasText:'주소를 복사'}).waitFor();
      const shared=await board.evaluate(()=>window.__copied);
      ok(`${mode}/${width}: top share copies permanent direct URL and stays keyboard accessible`,
        new URL(shared).pathname==='/lounge.html' && new URL(shared).searchParams.get('post')===P &&
        !new URL(shared).searchParams.has('embed') && await share.getAttribute('aria-label')==='글 주소 공유' &&
        await share.evaluate(b=>b.tabIndex===0&&!b.closest('.detail-actions')));
      await board.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('isolated clipboard denial');};});
      await share.click();
      await board.locator('#shareAddress').waitFor();
      ok(`${mode}/${width}: clipboard fallback retains a focused selectable URL`,
        await board.locator('#shareAddress').inputValue()===shared &&
        await board.locator('#shareAddress').evaluate(e=>e===document.activeElement&&e.selectionEnd===e.value.length));
      ok(`${mode}/${width}: title, share fallback and board do not overflow`,
        await board.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1) &&
        await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await f.close();
    }
    {
      const f=await fixture(),{state,page}=f;
      Object.assign(state.posts[0],{author_id:A,image_paths:[A+'/'+P+'/'+uid(710)+'.jpg'],view_count:9,
        observation:{method:'phone',location:'서울'},is_pinned:false});
      state.viewed.add(P);
      state.comments.push({id:uid(711),post_id:P,text:'남아야 할 댓글',nick:'B',author_id:B,created_at:now()});
      state.reactions.push({post_id:P,emoji:'⭐',author_id:A});
      const board=await open(f,embedded);
      // Keep a new-post draft before editing an existing post.
      await board.locator('#writeTop').click();
      await board.locator('#postTitle').fill('새 글의 독립 초안');
      await board.locator('#postInput').fill('수정에 의해 덮어쓰면 안 되는 새 글 본문');
      await board.locator('#orbitSelect').selectOption('free');
      await board.locator('#cancelWrite').click();
      await detail(board);
      await board.locator('.comment-body').filter({hasText:'남아야 할 댓글'}).waitFor();
      await board.waitForFunction(()=>document.querySelector('#postViews').textContent==='조회 9');
      const original=structuredClone(state.posts[0]);
      const viewRequests=state.viewCalls.length;
      const preserved={comments:structuredClone(state.comments),reactions:structuredClone(state.reactions),receipts:[...state.receipts],profile:structuredClone(state.profile),inserts:state.inserts};
      const draftPayload=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orbit_board_drafts_v1')).drafts.map(({updatedAt,...row})=>row));
      const drafts=await draftPayload();
      await board.locator('[data-action=edit-post]').click();
      await board.locator('#postInput').waitFor();
      ok(`${mode}: edit prefills fields and keeps photos read-only`,
        await board.locator('#postTitle').inputValue()===original.title &&
        await board.locator('#postInput').inputValue()===original.text &&
        await board.locator('#orbitSelect').inputValue()==='report' &&
        await board.locator('#observedLocation').inputValue()==='서울' &&
        await board.locator('#photoInput').isHidden() && await board.locator('#editPhotoNotice').isVisible());
      await board.locator('#postTitle').fill('취소할 변경');
      page.removeAllListeners('dialog');
      let confirms=0;
      page.on('dialog',async d=>{confirms++; await d.dismiss();});
      await board.locator('#cancelWrite').click();
      ok(`${mode}: dirty cancel can be rejected`,confirms===1&&await board.locator('#postTitle').inputValue()==='취소할 변경');
      const menuConfirmation=page.waitForEvent('dialog');
      await back(f,board,embedded);
      await menuConfirmation;
      ok(`${mode}: menu navigation also respects the dirty-edit confirmation`,confirms===2&&new URL(board.url()).searchParams.has('edit'));
      page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());
      await board.locator('#cancelWrite').click();
      await board.locator('.detail-title').waitFor();
      assert.deepEqual(state.posts[0],original,`${mode}: cancelled edit leaves stored row unchanged`);
      ok(`${mode}: cancelled edit leaves stored row unchanged`);
      await board.locator('[data-action=edit-post]').click();
      await board.locator('#postInput').fill('');
      await board.locator('#btnTrace').click();
      ok(`${mode}: empty body cannot save`,state.edits.length===0 && await board.locator('#postInput').isVisible());
      await board.locator('#postTitle').fill('수정한 달 관측 제목');
      await board.locator('#postInput').fill('수정 본문 검색어 수정성운');
      await board.locator('#orbitSelect').selectOption('gear');
      await board.locator('#observationFields').evaluate(d=>{d.open=true;});
      await board.locator('#observedMethod').selectOption('telescope');
      await board.locator('#observedLocation').fill('부산');
      await board.locator('#btnTrace').click();
      await board.locator('.detail-title').filter({hasText:'수정한 달 관측 제목'}).waitFor();
      await board.locator('.edited-label').waitFor();
      ok(`${mode}: one edit updates title, body, category and observation immediately`,state.edits.length===1 &&
        state.posts[0].text==='수정 본문 검색어 수정성운' && state.posts[0].orbit==='gear' &&
        state.posts[0].observation.location==='부산' && state.posts[0].observation.method==='telescope' &&
        await board.locator('.detail-body').innerText().then(t=>t.includes('수정성운')));
      for(const key of ['id','author_id','nick','created_at','image_paths','is_pinned','pinned_at','view_count'])
        assert.deepEqual(state.posts[0][key],original[key],`${mode}: ${key} retained`);
      assert.deepEqual({comments:state.comments,reactions:state.reactions,receipts:[...state.receipts],profile:state.profile,inserts:state.inserts},preserved);
      ok(`${mode}: author/date/photos/comments/reactions/views/pin/receipts/XP and insert count retained`);
      ok(`${mode}: edit save and cancel never request another view increment`,state.viewCalls.length===viewRequests);
      assert.deepEqual(await draftPayload(),drafts);
      ok(`${mode}: edit never overwrites the separate new-post draft`);
      await back(f,board,embedded);
      await board.locator('#post-'+P+' .row-title').filter({hasText:'수정한 달 관측 제목'}).waitFor();
      await search(board,'수정성운');
      await board.locator('#post-'+P).waitFor();
      await search(board,'기존 글의 본문');
      await board.locator('.empty-state').filter({hasText:'검색 결과가 없어요'}).waitFor();
      ok(`${mode}: list and searches use the edited title/body`);
      await board.locator('#writeTop').click();
      await board.waitForFunction(()=>document.querySelector('#postTitle').value==='새 글의 독립 초안');
      ok(`${mode}: returning to new writing restores its original draft`,await board.locator('#postInput').inputValue()==='수정에 의해 덮어쓰면 안 되는 새 글 본문');
      await f.close();
    }
    for(const admin of [false,true]) {
      const f=await fixture({admin}),{state}=f;
      state.posts[0].author_id=B;
      const board=await open(f,embedded);
      await detail(board);
      ok(`${mode}: ${admin?'admin':'member'} cannot edit another author; pin remains admin-only`,
        await board.locator('[data-action=edit-post]').count()===0 && await board.locator('[data-action=pin]').count()===(admin?1:0));
      if(admin) {
        state.posts[0].author_id=A;
        await back(f,board,embedded);await detail(board);
        await board.locator('[data-action=edit-post]').waitFor();
        ok(`${mode}: admin may edit their own post while retaining pin control`,await board.locator('[data-action=pin]').count()===1);
      }
      await f.close();
    }
    for(const signedIn of [false,true]) {
      const f=await fixture({registered:false,signedIn}),{state}=f;
      state.posts[0].author_id=A;
      const board=await open(f,embedded);
      await board.locator('#post-'+P+' .row-title').click();
      await board.locator('.detail-title').waitFor();
      ok(`${mode}: ${signedIn?'anonymous Auth with matching UUID':'visitor'} never sees edit`,await board.locator('[data-action=edit-post]').count()===0);
      await f.close();
    }
    for(const pending of [false,true]) {
      const f=await fixture(),{state,page}=f;
      state.posts[0].author_id=A;
      const board=await open(f,embedded);await detail(board);
      await board.locator('[data-action=edit-post]').click();
      await board.locator('#postTitle').fill('A 수정 중 비공개 제목');
      await board.locator('#postInput').fill('A 수정 중 비공개 본문');
      let gate;
      if(pending) {
        await board.evaluate(()=>{
          const client=createOrbitBackend(),rpc=client.rpc.bind(client);
          client.rpc=function(name,args) {
            const result=rpc(name,args);
            return name==='board_edit_post' ? (window.__editResponse=Promise.resolve(result)) : result;
          };
        });
        gate=f.defer((req,actor)=>actor===A&&new URL(req.url()).pathname.endsWith('/rpc/board_edit_post'));
        await board.locator('#btnTrace').click();await gate.entered;
      }
      await switchAccount(f,board,embedded,B);
      await board.waitForFunction(()=>!new URL(location.href).searchParams.has('edit'));
      await board.locator('.detail-title').waitFor();
      ok(`${mode}: A edit ${pending?'request':'buffer'} is unavailable to B`,
        await board.locator('[data-action=edit-post]').count()===0 && await board.locator('#editorView').isHidden());
      await back(f,board,embedded);
      await board.locator('#writeTop').click();
      await board.locator('#postTitle').fill('B의 새 초안');
      await board.locator('#postInput').fill('B의 편집 화면 유지');
      if(gate) {
        gate.release();await gate.finished;
        // Observe the real SDK promise and its awaiting continuation; a response
        // event alone would not prove the application handled the late result.
        await board.evaluate(async()=>{await window.__editResponse;await new Promise(queueMicrotask);});
      }
      await board.locator('#orbitSelect').selectOption('free');
      ok(`${mode}: late A edit response cannot navigate, reset or expose draft data in B`,
        await board.locator('#postTitle').inputValue()==='B의 새 초안' &&
        await board.locator('#postInput').inputValue()==='B의 편집 화면 유지' &&
        await board.evaluate(()=>OrbitMembers.state.user.id)===B &&
        state.edits.every(e=>e.actor===A) && state.inserts===0);
      await f.close();
    }
    {
      const f=await fixture(),{state}=f;
      state.posts[0].author_id=A;
      let release;
      state.memberVisitGate=new Promise(resolve=>{release=resolve;});
      const board=await open(f,embedded);
      await board.locator('#post-'+P+' .row-title').click();
      await board.locator('.detail-title').waitFor();
      ok(`${mode}: pending profile does not prematurely grant edit`,await board.locator('[data-action=edit-post]').count()===0);
      release();
      await board.locator('[data-action=edit-post]').waitFor();
      ok(`${mode}: late author profile makes edit available without reloading the detail`);
      await board.locator('[data-action=edit-post]').click();
      await board.locator('#postTitle').fill('');
      await board.locator('#postInput').fill('비워둔 제목은 첫 문장으로 만들어져요. 다음 문장.');
      await board.locator('#btnTrace').click();
      await board.locator('.detail-title').filter({hasText:'비워둔 제목은 첫 문장으로 만들어져요.'}).waitFor();
      ok(`${mode}: optional empty title keeps the existing first-sentence validation`,state.edits[0].p_title==='비워둔 제목은 첫 문장으로 만들어져요.');
      await f.close();
    }
    for(const gated of [false,true]) {
      const f=await fixture(),{state,page}=f;
      state.posts[0].author_id=A;
      let release;
      if(gated) state.memberVisitGate=new Promise(resolve=>{release=resolve;});
      let board;
      if(embedded) {
        board=await open(f,true);
        await board.goto(base+'/lounge.html?embed=1&post='+P+'&edit=1#report');
      } else {
        board=page;
        await page.goto(base+'/lounge.html?post='+P+'&edit=1#report');
      }
      if(gated) {
        await board.waitForFunction(()=>window.OrbitMembers?.state.user?.id);
        release();
      }
      await board.locator('#postForm:visible').waitFor();
      ok(`${mode}: direct edit URL survives initial Auth/profile setup, delayed=${gated}`,
        new URL(board.url()).searchParams.get('edit')==='1' &&
        await board.locator('#postTitle').inputValue()===state.posts[0].title &&
        await board.locator('#postInput').inputValue()===state.posts[0].text);
      await f.close();
    }
    {
      const f=await fixture(),{state}=f;
      state.posts[0].author_id=A;
      const board=await open(f,embedded);await detail(board);
      await board.locator('[data-action=edit-post]').click();
      await board.locator('#postTitle').fill('상세 재조회가 늦은 수정');
      // Observe the real SDK post-read promise, without replacing its result.
      await board.evaluate(()=>{
        const client=createOrbitBackend(),from=client.from.bind(client);
        client.from=function(table) {
          const builder=from(table);
          if(table==='posts') {
            const select=builder.select.bind(builder);
            builder.select=function(...args) {
              const query=select(...args),maybeSingle=query.maybeSingle.bind(query);
              query.maybeSingle=function(...args) {
                return window.__savedPostRead=Promise.resolve(maybeSingle(...args));
              };
              return query;
            };
          }
          return builder;
        };
      });
      const refresh=f.defer(req=>req.method()==='GET'&&new URL(req.url()).pathname==='/rest/v1/posts');
      await board.locator('#btnTrace').click();await refresh.entered;
      await back(f,board,embedded);
      await board.locator('#writeTop').click();
      await board.locator('#postTitle').fill('다음 새 글');
      await board.locator('#postInput').fill('앞선 수정 완료가 이 저장을 해제하면 안 돼요.');
      const create=f.defer(req=>new URL(req.url()).pathname.endsWith('/rpc/create_board_post'));
      await board.locator('#btnTrace').click();await create.entered;
      const saveMessage=await board.locator('#writeStatus').innerText();
      refresh.release();await refresh.finished;
      await board.evaluate(async()=>{
        await window.__savedPostRead;
        // A task boundary drains the promise continuations through loadDetail,
        // showRoute and saveEdit. It does not wait an arbitrary number of ms.
        await new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();c.port2.close();resolve();};c.port2.postMessage(null);});
      });
      ok(`${mode}: an old edit detail refresh cannot unlock or relabel a newer pending publication`,
        await board.locator('#btnTrace').isDisabled() && await board.locator('#postInput').isDisabled() &&
        await board.locator('#writeStatus').innerText()===saveMessage &&
        await board.locator('#postTitle').inputValue()==='다음 새 글');
      create.release();await create.finished;
      await board.locator('.detail-title').filter({hasText:'다음 새 글'}).waitFor();
      ok(`${mode}: newer publication completes exactly once after its own response`,state.inserts===1);
      await f.close();
    }
  }
}
