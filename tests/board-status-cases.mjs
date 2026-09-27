// Uses intercepted community fixtures; every write stays inside the test state.
export async function boardStatusRegressions({fixture,base,A,P,uid,ok}) {
  const copied='글 주소를 복사했어요.', deleted='글을 삭제했어요.';
  async function open(f,embedded) {
    await f.page.goto(base+(embedded?'/main.html#lounge':'/lounge.html'));
    if(!embedded) return f.page;
    await f.page.frameLocator('#loungeFrame').locator('#boardTitle').waitFor();
    return f.page.frames().find(frame=>new URL(frame.url()).pathname==='/lounge.html');
  }
  async function detail(board,id) {
    await board.locator('#post-'+id+' .row-title').click();
    await board.locator('.detail-title').waitFor();
    await board.locator('#commentInput:enabled').waitFor();
  }
  async function list(board) {
    await board.locator('#backToFeed').click();
    await board.locator('#postList[aria-busy=false]').waitFor();
  }
  async function noStatus(board) {
    return board.locator('#loungeStatus').evaluate(el=>el.textContent==='' &&
      getComputedStyle(el).display==='none' && el.getBoundingClientRect().height===0);
  }
  async function copy(board) {
    await board.locator('[data-action=share]').click();
    await board.locator('#loungeStatus').filter({hasText:copied}).waitFor();
  }
  for(const embedded of [false,true]) {
    for(const width of [1440,360]) {
      const label=(embedded?'iframe':'direct')+'/'+width, f=await fixture(), {page,state}=f;
      await page.setViewportSize({width,height:900});
      state.posts[0].author_id=A;
      const second=uid(8401),third=uid(8402);
      state.posts.push(...[second,third].map((id,i)=>({...state.posts[0],id,title:'안내 확인 글 '+(i+2)})));
      const board=await open(f,embedded);
      await detail(board,P);
      await board.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,
        value:{writeText:async text=>{window.__copiedBoardURL=text;}}}));
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(()=>Date.now()));

      await copy(board);
      ok(label+': share confirmation remains a polite live status',
        await board.locator('#loungeStatus').getAttribute('role')==='status' &&
        await board.locator('#loungeStatus').getAttribute('aria-live')==='polite' &&
        new URL(await board.evaluate(()=>window.__copiedBoardURL)).searchParams.get('post')===P);
      await page.clock.fastForward(4999);
      ok(label+': share confirmation stays readable for five seconds',await board.locator('#loungeStatus').innerText()===copied);
      await page.clock.fastForward(1);
      ok(label+': expired confirmation leaves no bar or reserved space',await noStatus(board));

      await copy(board);
      await page.clock.fastForward(2000);
      await copy(board);
      await page.clock.fastForward(3001);
      ok(label+': another share starts a fresh confirmation duration',await board.locator('#loungeStatus').innerText()===copied);
      await page.clock.fastForward(1999);
      ok(label+': repeated confirmation also expires completely',await noStatus(board));

      await copy(board);
      await list(board);
      ok(label+': returning to the list clears the previous share immediately',await noStatus(board));
      await detail(board,third);
      ok(label+': another post never inherits the previous confirmation',await noStatus(board));
      await copy(board);
      await board.evaluate(()=>history.back());
      await board.locator('#listView:visible').waitFor();
      ok(label+': browser Back clears confirmation',await noStatus(board));
      await board.evaluate(()=>history.forward());
      await board.locator('.detail-title').filter({hasText:'안내 확인 글 3'}).waitFor();
      ok(label+': browser Forward does not restore stale confirmation',await noStatus(board));

      await list(board);
      await detail(board,P);
      await board.locator('[data-action=delete-post]').click();
      await board.locator('#loungeStatus').filter({hasText:deleted}).waitFor();
      await board.locator('#postList[aria-busy=false]').waitFor();
      ok(label+': deletion confirmation survives arrival at the result list',
        await board.locator('#listView').isVisible() && !state.posts.some(p=>p.id===P) &&
        await board.locator('#loungeStatus').innerText()===deleted);
      await page.clock.fastForward(5000);
      ok(label+': deletion confirmation expires on the result list',await noStatus(board));
      await detail(board,second);
      await board.locator('[data-action=delete-post]').click();
      await board.locator('#loungeStatus').filter({hasText:deleted}).waitFor();
      await detail(board,third);
      ok(label+': opening another post clears deletion confirmation immediately',await noStatus(board));

      await copy(board);
      await page.clock.fastForward(2000);
      state.reactionWriteFail=true;
      await board.locator('[data-emoji]').first().click();
      await board.locator('#loungeStatus.error').filter({hasText:'공감 저장 실패'}).waitFor();
      const failure=await board.locator('#loungeStatus').innerText();
      await page.clock.fastForward(6000);
      ok(label+': an old success timer cannot erase a later error',
        await board.locator('#loungeStatus').innerText()===failure && await board.locator('#loungeStatus').isVisible());
      await list(board);
      ok(label+': route changes also clear errors from the former view',await noStatus(board));

      for(const rejected of [false,true]) {
        await detail(board,third);
        await board.evaluate(()=>{
          navigator.clipboard.writeText=()=>window.__pendingBoardCopy=new Promise((resolve,reject)=>{
            window.__completeBoardCopy=resolve;window.__rejectBoardCopy=reject;
          });
        });
        await board.locator('[data-action=share]').click();
        await list(board);
        await board.evaluate(async rejected=>{
          if(rejected) window.__rejectBoardCopy(new Error('isolated clipboard denial'));
          else window.__completeBoardCopy();
          await window.__pendingBoardCopy.catch(()=>{});
          await new Promise(resolve=>{
            const channel=new MessageChannel();
            channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};
            channel.port2.postMessage(null);
          });
        },rejected);
        ok(label+': late clipboard '+(rejected?'failure':'success')+' cannot change the next view',
          await noStatus(board) && await board.locator('#shareAddress').count()===0 &&
          await board.locator('#listView').isVisible());
      }
      ok(label+': transient notices preserve board and parent viewport width',
        await board.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1) &&
        await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await f.close();
    }
    {
      const label=embedded?'iframe':'direct', f=await fixture({admin:true}),{state}=f;
      const second=uid(8403);
      state.posts.push({...state.posts[0],id:second,title:'고정 응답 후 다른 글'});
      const board=await open(f,embedded);
      await detail(board,P);
      await board.locator('[data-action=pin]').waitFor();
      // Observe the first real detail-read promise without replacing its result.
      await board.evaluate(()=>{
        const client=createOrbitBackend(),from=client.from.bind(client);
        client.from=function(table) {
          const builder=from(table);
          if(table==='posts') {
            const select=builder.select.bind(builder);
            builder.select=function(...args) {
              const query=select(...args),single=query.maybeSingle.bind(query);
              query.maybeSingle=function(...args) {
                const result=Promise.resolve(single(...args));
                if(!window.__pinDetailRead) window.__pinDetailRead=result;
                return result;
              };
              return query;
            };
          }
          return builder;
        };
      });
      const reload=f.defer(req=>req.method()==='GET' && new URL(req.url()).pathname==='/rest/v1/posts');
      await board.locator('[data-action=pin]').click();
      await reload.entered;
      await list(board);
      await detail(board,second);
      reload.release();
      await reload.finished;
      await board.evaluate(async()=>{
        await window.__pinDetailRead;
        await new Promise(resolve=>{
          const channel=new MessageChannel();
          channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};
          channel.port2.postMessage(null);
        });
      });
      ok(label+': a late pin refresh cannot display confirmation on another post',
        state.posts.find(p=>p.id===P).is_pinned && await noStatus(board) &&
        await board.locator('.detail-title').innerText()==='고정 응답 후 다른 글');
      await f.close();
    }
  }
}
