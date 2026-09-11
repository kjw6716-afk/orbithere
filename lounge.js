    // ===== Supabase =====
    var sb = window.createOrbitBackend();

    // ===== 기본 데이터 =====
    // ===== 채널(궤도) 단일 설정 — 여기 한 줄만 추가하면 새 채널이 생깁니다 =====
    // 2026-08 개편: 잡담형 채널(자유·재테크·운동·반려동물)을 관측 주제로 갈아끼웠다.
    // 옛 id(money/dawn/pet)는 재사용하지 않고 새 id를 쓴다 — 재사용하면 예전
    // 재테크 글이 '장비'처럼 엉뚱한 이름표를 달게 된다. 옛 글은 아래 orbitInfo의
    // 폴백을 타서 🛰️ 칩으로 그대로 보인다.
    //
    // 다만 'free'만은 예외로 되살려 자유게시판으로 다시 쓴다. 옛 free 채널이
    // 원래 '자유'였으므로 주제가 그대로고, 옛 글이 자유게시판 이름표를 달아도
    // 엉뚱해지지 않는다. 덕분에 DB 제약(이미 free를 허용)도 손댈 필요가 없다.
    // ※ migration_008 하단의 '옛 글 정리' 쿼리 2)·3)은 이제 실행하면 안 된다.
    //
    // 새 궤도를 더할 때는 DB의 posts_orbit_check 제약도 같이 풀어야 한다.
    // (supabase/migration_008_sky_orbits.sql 참고) 안 그러면 글 작성이 23514로 막힌다.
    var ORBIT_LIST = [
        { id:'report', icon:'📝', label:'관측 후기',   desc:'어젯밤 뭘 보셨나요 — 관측 기록과 후기를 남기는 궤도예요.' },
        { id:'gear',   icon:'🔭', label:'장비',        desc:'장비 이야기를 나누는 궤도예요.', minor:true },
        { id:'live',   icon:'🌌', label:'실시간 하늘', desc:'지금 하늘이 어떤가요 — 속보를 바로 올리는 궤도예요.', minor:true },
        { id:'ask',    icon:'❓', label:'질문',        desc:'뭐부터 봐야 할지, 저건 뭔지 — 무엇이든 물어보는 궤도예요.', minor:true },
        { id:'free',   icon:'💬', label:'자유게시판',  desc:'자유로운 이야기를 하는 곳이에요.', minor:true }
    ];
    var ALL_ORBIT = { id:'all', icon:'🌠', label:'전체', desc:'모든 궤도의 궤적이 한데 흐르는 곳이에요.' };
    // 호환용 파생 맵 / 조회 헬퍼
    var ORBITS = {};
    ORBIT_LIST.forEach(function(o){ ORBITS[o.id] = o.label; });
    function orbitInfo(id){
        if(id === 'all') return ALL_ORBIT;
        for(var i=0;i<ORBIT_LIST.length;i++){ if(ORBIT_LIST[i].id === id) return ORBIT_LIST[i]; }
        return { id:id, icon:'🛰️', label:id, desc:'' }; // 사라진 옛 채널의 글도 깨지지 않게
    }
    var RX_EMOJIS = ['⭐','🔥','😂','🥰','👏','❤️'];
    var EMOJIS = ['🌟','⭐','🪐','🌙','☄️','🔭','🛸','💫','🌌','✨'];
    function avatarOf(nick){ return EMOJIS[nick.charCodeAt(0) % EMOJIS.length]; }

    function readLocal(key){ try { return localStorage.getItem(key); } catch(e){ return null; } }
    var nickname = readLocal('orbit_nickname');
    // 첫 진입 기본 채널은 후기 궤도 — 관측 → 후기가 이 사이트의 핵심 동선이고,
    // 글이 없는 시기에는 한 채널에 모여 있어야 살아 있는 곳으로 보인다.
    // sky.html의 CTA는 #report 해시를 달고 들어온다. (#all로 전체 보기도 가능)
    function orbitFromHash(){
        var h = (location.hash || '').slice(1);
        if(h === 'all') return 'all';
        for(var i = 0; i < ORBIT_LIST.length; i++){ if(ORBIT_LIST[i].id === h) return h; }
        return null;
    }
    var currentOrbit = orbitFromHash() || 'report';
    var EMBED = document.documentElement.classList.contains('embed');
    var PAGE_SIZE = 20, COMMENT_SIZE = 20;
    var loadedPosts = [], hasMorePosts = false, feedLoading = false;
    var searchTerm = (new URLSearchParams(location.search).get('q') || '').trim().slice(0,80);
    var requestedPost = new URLSearchParams(location.search).get('post');
    var singlePost = validId(requestedPost) ? requestedPost : null;
    var commentState = {}, commentDrafts = {}, pendingComments = {};
    function validId(id){ return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }
    // A stable (timestamp, UUID) cursor survives new inserts and deleted rows.
    // Only database values with a known shape reach the raw PostgREST expression.
    function afterCursor(query, row, ascending){
        if(!validId(row.id) || !/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(row.created_at)) throw new Error('목록 위치를 확인하지 못했어요. 새로고침해주세요.');
        var op = ascending ? 'gt' : 'lt';
        return query.or('created_at.' + op + '.' + row.created_at + ',and(created_at.eq.' + row.created_at + ',id.' + op + '.' + row.id + ')');
    }
    function updateFeedLocation(){
        var url = new URL(location.href);
        if(searchTerm) url.searchParams.set('q',searchTerm); else url.searchParams.delete('q');
        if(singlePost) url.searchParams.set('post',singlePost); else url.searchParams.delete('post');
        url.hash = currentOrbit;
        history.replaceState(null,'',url);
        document.getElementById('searchInput').value = searchTerm;
        document.getElementById('clearSearch').hidden = !searchTerm;
        document.getElementById('feedSearch').hidden = !!singlePost;
        document.getElementById('singlePostNav').hidden = !singlePost;
        document.getElementById('backToFeed').href = 'lounge.html#' + currentOrbit;
    }
    function updatePagination(){
        var button = document.getElementById('loadMore');
        button.hidden = !!singlePost || !hasMorePosts;
        button.disabled = feedLoading;
        button.textContent = feedLoading ? '불러오는 중…' : '이전 글 더 보기';
        document.getElementById('postList').setAttribute('aria-busy',String(feedLoading));
    }

    // 관리자 모드. 로그인만으로는 켜지지 않고 admins 테이블에 등록된 계정이어야 한다.
    // 여기서 true여도 실제 삭제를 허용하는 건 서버의 RLS라서,
    // 이 값을 브라우저에서 조작해도 남의 글은 지워지지 않는다. 버튼 표시용일 뿐이다.
    var isAdmin = false, currentUserId = null, writerPromise = null, securityVersion = null;
    var versionPromise = null;
    async function readSecurityVersion(){
        if(securityVersion === 2) return 2;
        if(versionPromise) return versionPromise;
        versionPromise = (async function(){
            var result = await sb.rpc('community_version');
            if(result.error && result.error.code !== 'PGRST202' && result.error.code !== '42883') throw result.error;
            securityVersion = result.error ? 1 : result.data;
            return securityVersion;
        })();
        try { return await versionPromise; } finally { versionPromise = null; }
    }
    function postColumns(){ return 'id,nick,orbit,text,created_at' + (securityVersion === 2 ? ',author_id' : ''); }
    function commentColumns(){ return 'id,post_id,nick,text,created_at' + (securityVersion === 2 ? ',author_id' : ''); }
    async function ensureWriter(){
        if(writerPromise) return writerPromise;
        writerPromise = (async function(){
            if(!sb) throw new Error('연결을 준비하지 못했어요. 새로고침 후 다시 시도해주세요.');
            if(securityVersion !== 2){
                var version = await readSecurityVersion();
                if(version !== 2) throw new Error('글쓰기 보안 업데이트를 준비하고 있어요. 잠시 후 다시 시도해주세요.');
                securityVersion = 2;
            }
            var session = await sb.auth.getSession();
            if(session.error) throw session.error;
            var user = session.data && session.data.session && session.data.session.user;
            if(!user){
                var signed = await sb.auth.signInAnonymously();
                if(signed.error) throw signed.error;
                user = signed.data.user;
            }
            if(!user) throw new Error('작성 권한을 확인하지 못했어요. 다시 시도해주세요.');
            currentUserId = user.id;
            return user.id;
        })();
        try { return await writerPromise; } finally { writerPromise = null; }
    }
    async function writeAction(action){
        try { await ensureWriter(); return await action(); }
        catch(error) { return { error: error }; }
    }
    var loadSequence = 0, feedAvailable = false, panelActive = !document.documentElement.classList.contains('embed');

    // 닉네임을 정하는 곳은 main.html의 진입 대화상자 하나뿐이다.
    // 임베드(메인 패널 안)일 땐 부모에게 열어달라고 요청하고,
    // 단독 페이지일 땐 #join 해시를 달고 넘어간다 — main.html이 그 해시를 보고 연다.
    function goJoin(){
        if(EMBED && window.parent !== window){ window.parent.postMessage({ orbit: 'join' }, window.location.origin); }
        else { location.href = 'main.html#join'; }
    }

    // 리액션 캐시: { postId: {emoji: count} } / 내 리액션: { postId: {emoji: true} }
    var rxCount = {}, rxMine = {}, rxUnavailable = {};

    // Comments are fetched only when opened, with independent cursors per post.
    var cmts = {};
    // 펼쳐 둔 댓글창: { postId: true }
    // 새로고침해도 보고 있던 스레드가 접히지 않도록 렌더 사이에 남긴다.
    var openThreads = {}, pendingReactions = {};

    function escapeHtml(s){
        // 작은따옴표까지 막는다. 지금은 모든 속성을 큰따옴표로 쓰지만,
        // 나중에 title='...' 같은 걸 한 줄 쓰는 순간 구멍이 되기 때문에 미리 닫아둔다.
        return String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function timeAgo(iso){
        var s = (Date.now() - new Date(iso).getTime()) / 1000;
        if(s < 60) return '방금 전';
        if(s < 3600) return Math.floor(s/60) + '분 전';
        if(s < 86400) return Math.floor(s/3600) + '시간 전';
        if(s < 86400*7) return Math.floor(s/86400) + '일 전';
        return new Date(iso).toLocaleDateString('ko-KR');
    }
    function setStatus(t, isErr){
        var el = document.getElementById('loungeStatus');
        el.textContent = t;
        el.style.color = isErr ? '#FC8181' : '';
        el.style.borderColor = isErr ? 'rgba(252,129,129,0.35)' : '';
    }

    // ===== 글쓰기 카드 =====
    function renderWriteCard(){
        var card = document.getElementById('writeCard');
        if(!nickname){
            card.innerHTML =
                '<div class="need-join">' +
                '<p>궤도에 진입하면 궤적을 남길 수 있어요</p>' +
                '<button class="btn-go-join" onclick="goJoin()">궤도 진입하러 가기</button>' +
                '</div>';
            return;
        }
        var orbitOptions = ORBIT_LIST.map(function(o){
            return '<option value="' + o.id + '">' + o.icon + ' ' + escapeHtml(o.label) + '</option>';
        }).join('');
        card.innerHTML =
            '<div class="write-head">' +
            '<div class="write-avatar">' + avatarOf(nickname) + '</div>' +
            '<div class="write-nick">' + escapeHtml(nickname) + '</div>' +
            '<select class="write-orbit-select" id="orbitSelect" aria-label="글을 남길 채널">' + orbitOptions + '</select>' +
            '</div>' +
            '<textarea id="postInput" maxlength="500" aria-label="게시글 내용" placeholder="무엇을 보셨나요? 관측한 시각과 대략적인 지역도 함께 적어주세요."></textarea>' +
            '<p class="write-hint">관측 후기라면 본 대상 · 시각 · 시·군 정도의 지역 · 사용한 장비를 적어주세요. 자세한 주소는 남기지 마세요.</p>' +
            '<div class="write-foot">' +
            '<span class="write-count" id="charCount">0 / 500</span>' +
            '<button class="btn-trace" id="btnTrace" disabled>궤적 남기기</button>' +
            '</div>';

        // 지금 보고 있는 채널을 기본 선택 — "이 방에 글 쓴다" 느낌
        var sel = document.getElementById('orbitSelect');
        if(sel && currentOrbit !== 'all') sel.value = currentOrbit;

        var input = document.getElementById('postInput');
        var btn = document.getElementById('btnTrace');
        input.addEventListener('input', function(){
            document.getElementById('charCount').textContent = input.value.length + ' / 500';
            btn.disabled = input.value.trim().length === 0;
        });
        btn.addEventListener('click', async function(){
            var text = input.value.trim();
            if(!text || !sb || btn.dataset.sending) return;
            btn.dataset.sending = '1';
            btn.disabled = true;
            input.disabled = true;
            var selectedOrbit=document.getElementById('orbitSelect');
            selectedOrbit.disabled=true;
            btn.textContent = '남기는 중...';
            var res = await writeAction(function(){ return sb.from('posts').insert({
                nick: nickname,
                orbit: document.getElementById('orbitSelect').value,
                text: text,
                author_device: currentUserId, author_id: currentUserId
            }); });
            delete btn.dataset.sending;
            input.disabled = false;
            selectedOrbit.disabled=false;
            btn.textContent = '궤적 남기기';
            if(res.error){
                btn.disabled = false;
                setStatus('전송 실패 — ' + errHint(res.error), true);
                console.error(res.error);
            } else {
                input.value = '';
                document.getElementById('charCount').textContent = '0 / 500';
                setStatus('β 베타 — 궤적은 모두에게 공개 저장돼요');
                searchTerm = ''; singlePost = null;
                selectOrbit(document.getElementById('orbitSelect').value);
            }
        });
    }

    // ===== 글 불러오기 =====
    // opts.quiet — 새로고침처럼 이미 보고 있는 목록을 갱신하는 경우.
    // 로딩 문구로 목록을 지우지 않고, 실패해도 보던 궤적을 남겨둔다.
    async function loadPosts(opts){
        opts = opts || {};
        if(opts.more && (feedLoading || !hasMorePosts)) return;
        var requestId = ++loadSequence, requestOrbit = currentOrbit;
        var requestSearch = searchTerm, requestPost = singlePost;
        var quiet = !!opts.quiet, more = !!opts.more;
        var previous = more ? loadedPosts.slice() : [];
        var list = document.getElementById('postList');
        var pageStatus = document.getElementById('pageStatus');
        feedLoading = true;
        updatePagination();
        pageStatus.textContent = '';
        if(!quiet && !more) list.innerHTML = '<div class="empty-state">궤적을 불러오는 중...</div>';
        try {
            if(!sb) throw new Error('연결을 준비하지 못했어요. 새로고침해주세요.');
            if(requestSearch.includes('*')) throw new Error('별표(*)를 제외한 단어로 검색해주세요.');
            await readSecurityVersion();
            if(requestId !== loadSequence) return;
            var q = sb.from('posts').select(postColumns()).order('created_at', {ascending:false}).order('id', {ascending:false}).limit(PAGE_SIZE + 1);
            if(requestPost) q = q.eq('id',requestPost);
            else {
                if(requestOrbit !== 'all') q = q.eq('orbit',requestOrbit);
                if(requestSearch) q = q.ilike('text','%' + requestSearch.replace(/[\\%_]/g,'\\$&') + '%');
                if(more && previous.length) q = afterCursor(q,previous[previous.length-1],false);
            }
            var res = await q;
            if(requestId !== loadSequence) return;
            if(res.error) throw res.error;
            var rows = res.data || [];
            var page = rows.slice(0,PAGE_SIZE);
            var nextRxCount = more ? Object.assign({},rxCount) : {}, nextRxMine = more ? Object.assign({},rxMine) : {};
            var nextRxUnavailable = more ? Object.assign({},rxUnavailable) : {};
            var reactionError = false;
            if(page.length){
                var r;
                try { r = await sb.rpc('reaction_summary', {p_post_ids:page.map(function(p){return p.id;}), p_device:null}); }
                catch(error) { r = {error:error}; }
                if(requestId !== loadSequence) return;
                if(r.error) reactionError = true;
                else (r.data || []).forEach(function(row){
                    (nextRxCount[row.post_id] = nextRxCount[row.post_id] || {})[row.emoji] = Number(row.n) || 0;
                    if(row.mine) (nextRxMine[row.post_id] = nextRxMine[row.post_id] || {})[row.emoji] = true;
                });
            }
            if(requestId !== loadSequence) return;
            // A secondary reaction outage must not hide readable posts.
            if(!reactionError){rxCount=nextRxCount;rxMine=nextRxMine;}
            page.forEach(function(p){ if(reactionError) nextRxUnavailable[p.id]=true; else delete nextRxUnavailable[p.id]; });
            rxUnavailable=nextRxUnavailable;
            var seen = new Set(previous.map(function(p){return p.id;}));
            loadedPosts = previous.concat(page.filter(function(p){return !seen.has(p.id);}));
            hasMorePosts = !requestPost && rows.length > PAGE_SIZE;
            feedAvailable = true;
            if(requestPost && page.length){
                currentOrbit = ORBITS[page[0].orbit] ? page[0].orbit : 'all';
                renderOrbitTabs();renderChannelHeader();updateFeedLocation();
                var select = document.getElementById('orbitSelect');
                if(select && currentOrbit !== 'all') select.value = currentOrbit;
            }
            setStatus(reactionError ? '글은 불러왔지만 리액션을 확인하지 못했어요. 잠시 후 새로고침해주세요.' : (isAdmin ? '🛰️ 관리자 모드' : '게시글은 모두에게 공개됩니다'),reactionError);
            document.getElementById('feedContext').textContent = requestPost ? '공유된 게시글' : (requestSearch ? '“' + requestSearch + '” · ' : '') + orbitInfo(currentOrbit).label + ' · ' + loadedPosts.length + '개 표시';
            renderPosts(loadedPosts,quiet || more);
            pageStatus.textContent = hasMorePosts ? '' : (loadedPosts.length && !requestPost ? '마지막 글까지 확인했어요.' : '');
            if(more && page.length){
                var added=document.getElementById('post-' + page[0].id);
                if(added) added.focus({preventScroll:true});
                pageStatus.textContent = page.length + '개를 더 불러왔어요.' + (hasMorePosts ? '' : ' 마지막 글입니다.');
            }
        } catch(err){
            if(requestId !== loadSequence) return;
            console.error(err);
            if(more){pageStatus.textContent='이전 글을 불러오지 못했어요. 아래 버튼으로 다시 시도해주세요.';setStatus('불러오기 실패 — ' + errHint(err),true);}
            else if(quiet && feedAvailable) setStatus('새로고침 실패 — ' + errHint(err),true);
            else {
                feedAvailable=false;hasMorePosts=false;
                list.innerHTML='<div class="load-error" role="status"><strong>지금은 게시판에 연결할 수 없어요</strong><p>잠시 후 다시 시도해주세요. 작성 중인 내용은 이 화면에 남아 있어요.</p><button type="button" id="retryFeed">다시 불러오기</button><br><a href="planets.html" target="_top">오늘 밤 하늘 먼저 보기 →</a></div>';
                document.getElementById('retryFeed').addEventListener('click',function(){loadPosts();});
            }
        } finally {
            if(requestId === loadSequence){feedLoading=false;updatePagination();}
        }
    }

    // 에러를 사람이 읽을 수 있는 힌트로 — 원인 파악용
    function errHint(err){
        if(!err) return '알 수 없는 오류';
        var m = (err.message || '') + '';
        if(/orbit_report_rate_limit/i.test(m))
            return '신고를 너무 빠르게 보내고 있어요 — 잠시 후 다시 시도해주세요';
        if(/orbit_comment_rate_limit/i.test(m))
            return '답을 너무 빠르게 남기고 있어요 — 잠시 쉬었다가 다시 남겨주세요';
        if(/orbit_rate_limit/i.test(m))
            return '궤적을 너무 빠르게 남기고 있어요 — 잠시 쉬었다가 다시 남겨주세요';
        if(/Failed to fetch|NetworkError|Load failed|AbortError|aborted/i.test(m))
            return '연결이 지연되고 있어요. 잠시 후 다시 시도해주세요.';
        if(err.code === '42501' || /row-level security/i.test(m))
            return '작성 권한을 확인하지 못했어요. 새로고침 후 다시 시도해주세요.';
        if(err.code === '23514' || /check constraint/i.test(m))
            return '입력값이 규칙에 맞지 않아요 (닉네임 2~12자, 글 1~500자)';
        if(/JWT|api key|Invalid authentication/i.test(m))
            return '연결을 확인하고 있어요. 잠시 후 다시 시도해주세요.';
        if(/[가-힣]/.test(m)) return m.slice(0, 120);
        return '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.';
    }

    // quiet일 때는 등장 애니메이션을 생략한다. 새로고침마다 목록 전체가
    // 다시 떠오르면 바뀐 게 없어도 화면이 요동쳐서 오히려 어수선하다.
    function renderPosts(posts, quiet){
        var list = document.getElementById('postList');
        list.innerHTML = '';
        if(posts.length === 0){
            list.innerHTML = '<div class="empty-state"><p>' + (singlePost ? '이 글을 찾을 수 없어요. 삭제되었거나 주소가 달라졌을 수 있습니다.' : searchTerm ? '검색 결과가 없어요. 다른 검색어를 입력하거나 전체 채널에서 찾아보세요.' : '아직 이 궤도에는 궤적이 없어요.<br>첫 번째 궤적을 남겨보세요!') + '</p></div>';
            return;
        }
        posts.forEach(function(p, i){
            // "나"는 닉네임이 아니라 작성 기기로 판단한다.
            // 닉네임은 자유 입력이므로 소유권의 근거가 될 수 없다.
            // 서버가 발급한 사용자 ID(author_id)로만 내 글을 판단한다. 이전 글은 관리자에게 삭제를 요청한다.
            var isMine = !!(p.author_id && p.author_id === currentUserId);
            var canDelete = isMine || isAdmin;
            var post = document.createElement('article');
            post.className = 'post';
            post.id = 'post-' + p.id;
            post.tabIndex = -1;
            if(quiet) post.style.animation = 'none';
            else post.style.animationDelay = (Math.min(i, 10) * 0.05) + 's';
            post.innerHTML =
                '<div class="post-head">' +
                '<div class="post-avatar">' + avatarOf(p.nick) + '</div>' +
                '<div class="post-meta">' +
                '<div class="post-nick">' + escapeHtml(p.nick) + (isMine ? ' <span style="font-size: 12px;color:#9F7AEA;">나</span>' : '') + '</div>' +
                '<div class="post-sub"><time datetime="' + escapeHtml(p.created_at) + '" title="' + escapeHtml(new Date(p.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}) + ' KST') + '">' + timeAgo(p.created_at) + '</time></div>' +
                '</div>' +
                '<span class="post-orbit-chip' + (isMine?' mine':'') + '">' + orbitInfo(p.orbit).icon + ' ' + escapeHtml(orbitInfo(p.orbit).label) + '</span>' +
                '</div>' +
                '<div class="post-body">' + escapeHtml(p.text) + '</div>' +
                '<div class="post-foot">' +
                '<div class="reaction-row"></div>' +
                '<button class="btn-cmt' + (openThreads[p.id] ? ' on' : '') + '" type="button" title="댓글" aria-expanded="' + !!openThreads[p.id] + '">' +
                '<span>💬</span><span class="cn">' + commentLabel(p.id) + '</span></button>' +
                '<button class="btn-share" type="button">글 공유</button>' +
                // 내 글은 신고할 이유가 없다 — 지우면 되니까
                (isMine ? '' : reportBtn('post', p.id)) +
                (canDelete ? '<button class="btn-del" title="궤적 삭제"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button>' : '') +
                '</div>' +
                '<div class="cmt-thread"' + (openThreads[p.id] ? '' : ' style="display:none;"') + '></div>';
            list.appendChild(post);
            renderRxRow(post.querySelector('.reaction-row'), p);
            post.querySelector('.btn-share').addEventListener('click',function(){sharePost(p,post);});
            if(canDelete){
                post.querySelector('.btn-del').addEventListener('click', function(){ deletePost(p, post); });
            }

            var btnCmt = post.querySelector('.btn-cmt');
            btnCmt.addEventListener('click', function(){
                var open = !openThreads[p.id];
                if(open) openThreads[p.id] = true; else delete openThreads[p.id];
                btnCmt.classList.toggle('on', open);
                btnCmt.setAttribute('aria-expanded',String(open));
                post.querySelector('.cmt-thread').style.display = open ? '' : 'none';
                if(open){renderThread(post,p);if(!commentState[p.id] || !commentState[p.id].loaded) refreshThread(p,post);}
            });
            // 새로고침 전에 펼쳐져 있던 스레드는 그대로 열어둔 채로 그린다
            if(openThreads[p.id]){renderThread(post,p);if(!commentState[p.id] || !commentState[p.id].loaded) refreshThread(p,post);}
        });
    }

    async function sharePost(p,post){
        var url = new URL('lounge.html',location.href);
        url.searchParams.set('post',p.id);
        url.hash = ORBITS[p.orbit] ? p.orbit : 'all';
        try {
            await navigator.clipboard.writeText(url.href);
            setStatus('이 글의 주소를 복사했어요.');
        } catch(e){
            var field=post.querySelector('.share-link');
            if(!field){field=document.createElement('input');field.className='share-link';field.readOnly=true;field.setAttribute('aria-label','공유할 글 주소');post.appendChild(field);}
            field.value=url.href;field.focus();field.select();
            setStatus('주소를 선택했어요. 복사 메뉴를 이용해주세요.');
        }
    }
    function commentLabel(id){
        var state=commentState[id];
        return !state || !state.loaded ? '댓글 보기' : (cmts[id] || []).length + (state.more ? '+' : '');
    }

    // ===== 신고 =====
    var REPORT_REASONS = [
        { id:'spam',    label:'도배 · 광고' },
        { id:'abuse',   label:'욕설 · 비방' },
        { id:'adult',   label:'선정적이거나 불쾌한 내용' },
        { id:'privacy', label:'개인정보 노출' },
        { id:'etc',     label:'기타 · 내 글 삭제 요청' }
    ];
    // 이 기기가 이번 세션에서 신고한 대상 — 버튼을 눌린 상태로 유지한다.
    // 서버에도 (대상, 기기) 유니크 제약이 있어 중복은 어차피 막힌다.
    var reported = {};

    var FLAG_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>';

    function reportBtn(type, id){
        var done = reported[type + ':' + id];
        return '<button class="btn-report' + (done ? ' done' : '') + '" type="button"' +
               ' data-rp-type="' + type + '" data-rp-id="' + escapeHtml(id) + '"' +
               ' title="' + (done ? '신고함' : '신고하기') + '">' + FLAG_ICON + '</button>';
    }

    // 신고 버튼은 글·답 어디에나 있고 목록이 다시 그려지므로 문서 단위로 위임한다
    document.addEventListener('click', function(e){
        var btn = e.target.closest('.btn-report');
        if(!btn || btn.classList.contains('done')) return;
        e.stopPropagation();
        var type = btn.getAttribute('data-rp-type');
        var id   = btn.getAttribute('data-rp-id');
        var box  = btn.closest(type === 'post' ? '.post' : '.cmt');
        var body = box ? box.querySelector(type === 'post' ? '.post-body' : '.cmt-body') : null;
        openReport(type, id, body ? body.textContent : '', btn);
    });

    function openReport(type, id, quote, btn){
        var back = document.createElement('div');
        back.className = 'rp-back';
        back.innerHTML =
            '<div class="rp-box" role="dialog" aria-modal="true" aria-label="신고하기">' +
            '<h3>이 ' + (type === 'post' ? '궤적' : '답') + '을 신고할까요?</h3>' +
            '<p class="rp-sub">내용은 운영자만 확인합니다. 직접 삭제할 수 없는 내 글은 ‘기타 · 내 글 삭제 요청’을 선택해주세요. 비밀번호나 신분증은 보내지 마세요.</p>' +
            (quote ? '<div class="rp-quote">' + escapeHtml(quote.slice(0, 120)) +
                     (quote.length > 120 ? '…' : '') + '</div>' : '') +
            '<div class="rp-reasons">' +
            REPORT_REASONS.map(function(r, i){
                return '<label class="rp-reason' + (i === 0 ? ' on' : '') + '">' +
                       '<input type="radio" name="rp" value="' + r.id + '"' + (i === 0 ? ' checked' : '') + '>' +
                       escapeHtml(r.label) + '</label>';
            }).join('') +
            '</div>' +
            '<textarea class="rp-detail" maxlength="200" aria-label="신고 또는 삭제 요청 설명" placeholder="요청 이유와 확인에 도움이 될 내용을 적어주세요 (선택)"></textarea>' +
            '<div class="rp-acts">' +
            '<button class="rp-cancel" type="button">취소</button>' +
            '<button class="rp-send" type="button">신고하기</button>' +
            '</div></div>';
        document.body.appendChild(back);

        var previousFocus = document.activeElement;
        var backgrounds=Array.from(document.body.children).filter(function(el){return el!==back && !el.inert;});
        backgrounds.forEach(function(el){el.inert=true;});
        var close = function(){ back.remove(); backgrounds.forEach(function(el){el.inert=false;});document.removeEventListener('keydown', onKey); if(previousFocus && previousFocus.isConnected) previousFocus.focus(); };
        function onKey(ev){
            if(ev.key === 'Escape') { close(); return; }
            if(ev.key !== 'Tab') return;
            var controls = Array.from(back.querySelectorAll('input,textarea,button')).filter(function(el){return !el.disabled;});
            var first = controls[0], last = controls[controls.length-1];
            if(ev.shiftKey && document.activeElement === first){ ev.preventDefault(); last.focus(); }
            else if(!ev.shiftKey && document.activeElement === last){ ev.preventDefault(); first.focus(); }
        }
        back.querySelector('input').focus();
        document.addEventListener('keydown', onKey);
        back.addEventListener('click', function(ev){ if(ev.target === back) close(); });
        back.querySelector('.rp-cancel').addEventListener('click', close);

        // 라디오 선택 표시
        back.querySelectorAll('.rp-reason').forEach(function(l){
            l.addEventListener('click', function(){
                back.querySelectorAll('.rp-reason').forEach(function(x){ x.classList.remove('on'); });
                l.classList.add('on');
            });
        });

        var send = back.querySelector('.rp-send');
        send.addEventListener('click', async function(){
            if(!sb || send.dataset.busy) return;
            send.dataset.busy = '1'; send.disabled = true; send.textContent = '보내는 중...';
            var reason = back.querySelector('input[name="rp"]:checked').value;
            var detail = back.querySelector('.rp-detail').value.trim();
            var res = await writeAction(function(){ return sb.from('reports').insert({
                target_type: type, target_id: id, reason: reason,
                detail: detail || null, reporter_device: currentUserId, author_id: currentUserId
            }); });
            delete send.dataset.busy;

            // 유니크 제약(23505) = 이미 신고한 대상. 실패가 아니라 이미 접수된 상태다.
            if(res.error && res.error.code !== '23505'){
                send.disabled = false; send.textContent = '신고하기';
                setStatus('신고 실패 — ' + errHint(res.error), true);
                console.error(res.error);
                return;
            }
            reported[type + ':' + id] = true;
            if(btn){ btn.classList.add('done'); btn.title = '신고함'; }
            close();
            setStatus(res.error ? '이미 신고한 ' + (type === 'post' ? '궤적' : '답') + '이에요'
                                : '신고를 접수했어요. 확인 후 조치할게요');
        });
    }

    // ===== 댓글 =====
    function renderThread(post, p){
        var thread = post.querySelector('.cmt-thread');
        var list = cmts[p.id] || [];
        var html = '<p class="cmt-message">최근 댓글부터 표시해요. <button class="cmt-refresh" type="button">댓글 새로고침</button></p>';

        var state = commentState[p.id] || {};
        if(state.error){
            html += '<p class="cmt-message" role="status">댓글을 불러오지 못했어요. 작성 중인 내용은 유지됩니다.</p><button class="cmt-retry" type="button">댓글 다시 불러오기</button>';
        } else if(!state.loaded){
            html += '<p class="cmt-message" role="status">댓글을 불러오는 중…</p>';
        }
        if(state.loaded && !list.length){
            html += '<div class="cmt-empty">아직 답이 없어요. 첫 답을 남겨보세요.</div>';
        } else if(list.length) {
            html += '<div class="cmt-list">';
            list.forEach(function(c){
                // '나' 배지는 내가 쓴 것에만, 삭제 버튼은 내 것 + 관리자.
                // 둘을 한 변수로 묶으면 관리자에게 남의 답이 전부 '나'로 보인다.
                var own = !!(c.author_id && c.author_id === currentUserId);
                var canDel = own || isAdmin;
                html +=
                    '<div class="cmt" data-cid="' + escapeHtml(c.id) + '">' +
                    '<div class="cmt-av">' + avatarOf(c.nick) + '</div>' +
                    '<div class="cmt-main">' +
                    '<div class="cmt-meta">' +
                    '<span class="cmt-nick">' + escapeHtml(c.nick) + '</span>' +
                    (own ? '<span class="cmt-me">나</span>' : '') +
                    '<span class="cmt-time">' + timeAgo(c.created_at) + '</span>' +
                    '</div>' +
                    '<div class="cmt-body">' + escapeHtml(c.text) + '</div>' +
                    '</div>' +
                    (own ? '' : reportBtn('comment', c.id)) +
                    (canDel ? '<button class="btn-cmt-del" type="button" title="' +
                              (own ? '답 삭제' : '관리자 삭제') + '"' +
                              (own ? '' : ' data-admin="1"') + '>×</button>' : '') +
                    '</div>';
            });
            html += '</div>';
        }
        if(state.more) html += '<button class="cmt-more" type="button"' + (state.loading ? ' disabled' : '') + '>' + (state.loading ? '불러오는 중…' : '이전 댓글 더 보기') + '</button>';

        html += nickname
            ? '<div class="cmt-write">' +
              '<input type="text" maxlength="300" aria-label="댓글 내용" placeholder="답을 남겨보세요">' +
              '<button class="btn-cmt-send" type="button" disabled>등록</button>' +
              '</div>'
            : '<div class="cmt-need-join">궤도에 진입하면 답을 남길 수 있어요 · ' +
              '<button type="button" class="cmt-join">궤도 진입하러 가기</button></div>';

        thread.innerHTML = html;
        wireThread(post, p, thread);
    }

    function wireThread(post, p, thread){
        var input = thread.querySelector('.cmt-write input');
        var send  = thread.querySelector('.btn-cmt-send');
        if(input && send){
            input.value=commentDrafts[p.id] || '';
            input.disabled=!!pendingComments[p.id];
            send.disabled=!!pendingComments[p.id] || !input.value.trim();
            input.addEventListener('input', function(){
                commentDrafts[p.id]=input.value;
                send.disabled = input.value.trim().length === 0;
            });
            input.addEventListener('keydown', function(e){
                if(e.key === 'Enter' && !e.isComposing && !send.disabled) send.click();
            });
            send.addEventListener('click', function(){ submitComment(p, post, input, send); });
        }
        var join = thread.querySelector('.cmt-join');
        if(join) join.addEventListener('click', goJoin);
        var more = thread.querySelector('.cmt-more');
        if(more) more.addEventListener('click',function(){refreshThread(p,post,{more:true});});
        var refresh = thread.querySelector('.cmt-refresh');
        if(refresh) refresh.addEventListener('click',function(){refreshThread(p,post);});
        var retry = thread.querySelector('.cmt-retry');
        if(retry) retry.addEventListener('click',function(){refreshThread(p,post,{more:!!(commentState[p.id] && commentState[p.id].failedMore)});});

        thread.querySelectorAll('.btn-cmt-del').forEach(function(b){
            b.addEventListener('click', function(){
                deleteComment(p, post, b.closest('.cmt').getAttribute('data-cid'),
                              b.hasAttribute('data-admin'));
            });
        });
    }

    // 이 글의 댓글만 다시 받아 스레드와 개수를 갱신한다 (전체 목록은 건드리지 않음)
    async function refreshThread(p, post, opts){
        opts=opts || {};
        var state=commentState[p.id] || (commentState[p.id]={});
        if(state.loading) return;
        var previous=opts.more ? (cmts[p.id] || []).slice() : [];
        state.loading=true;state.error=false;
        renderThread(post,p);
        try {
            var q = sb.from('comments').select(commentColumns())
                .eq('post_id',p.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(COMMENT_SIZE+1);
            if(opts.more && previous.length) q=afterCursor(q,previous[previous.length-1],false);
            var r = await q;
            if(r.error) throw r.error;
            var rows=r.data || [], seen=new Set(previous.map(function(c){return c.id;}));
            cmts[p.id]=previous.concat(rows.slice(0,COMMENT_SIZE).filter(function(c){return !seen.has(c.id);}));
            state.more=rows.length>COMMENT_SIZE;state.loaded=true;state.failedMore=false;
        } catch(err){
            console.error(err);
            state.error=true;state.failedMore=!!opts.more;
            setStatus('댓글을 불러오지 못했어요 — ' + errHint(err), true);
        } finally {
            state.loading=false;
            // The feed may have been redrawn while this thread was loading.
            var current=document.getElementById('post-' + p.id);
            if(current){
                var cn=current.querySelector('.btn-cmt .cn');
                if(cn) cn.textContent=commentLabel(p.id);
                if(openThreads[p.id]) renderThread(current,p);
            }
        }
    }

    async function submitComment(p, post, input, send){
        var text = input.value.trim();
        if(!text || !sb || pendingComments[p.id]) return;
        pendingComments[p.id]=true;
        send.dataset.sending = '1';
        send.disabled = true;
        input.disabled = true;
        send.textContent = '...';
        var res = await writeAction(function(){ return sb.from('comments').insert({
            post_id: p.id, nick: nickname, text: text, author_device: currentUserId, author_id: currentUserId
        }); });
        delete send.dataset.sending;
        delete pendingComments[p.id];
        input.disabled=false;
        send.textContent = '등록';
        if(res.error){
            send.disabled = false;
            setStatus('전송 실패 — ' + errHint(res.error), true);
            console.error(res.error);
            var current=document.getElementById('post-' + p.id);
            if(current && current!==post && openThreads[p.id]) renderThread(current,p);
            return;
        }
        input.value = '';
        delete commentDrafts[p.id];
        setStatus('댓글을 등록했어요. 새 댓글이 맨 위에 표시됩니다.');
        await refreshThread(p, post);
    }

    async function deleteComment(p, post, cid, asAdmin){
        if(!sb || !cid) return;
        if(!confirm(asAdmin ? '[관리자] 이 답을 삭제할까요? 되돌릴 수 없어요.'
                            : '이 답을 삭제할까요? 되돌릴 수 없어요.')) return;
        var res = await writeAction(function(){ return sb.from('comments').delete().eq('id', cid).select('id'); });
        if(!res.error && (!res.data || !res.data.length)) res.error = new Error('삭제 권한을 확인하지 못했어요.');
        if(res.error){
            console.error(res.error);
            setStatus('삭제 실패 — 잠시 후 다시 시도해주세요', true);
            return;
        }
        await refreshThread(p, post);
    }

    // ===== 궤적 삭제 (작성한 기기 또는 관리자) =====
    // 내 글과 관리자 삭제 모두 서버 RLS가 인증된 사용자를 확인한다.
    // 관리자 경로가 통과되는 근거는 서버의 RLS 정책(is_admin())이지
    // 아래 isAdmin 변수가 아니다 — 변수는 어느 요청을 보낼지만 고른다.
    async function deletePost(p, el){
        if(!sb) return;
        var mine = !!(p.author_id && p.author_id === currentUserId);
        if(!confirm(mine ? '이 궤적을 삭제할까요? 되돌릴 수 없어요.'
                         : '[관리자] ' + p.nick + ' 님의 궤적을 삭제할까요? 되돌릴 수 없어요.')) return;
        var res = await writeAction(function(){ return sb.from('posts').delete().eq('id', p.id).select('id'); });
        if(!res.error && (!res.data || !res.data.length)) res.error = new Error('삭제 권한을 확인하지 못했어요.');
        if(res.error){
            console.error(res.error);
            setStatus('삭제 실패 — 잠시 후 다시 시도해주세요', true);
            return;
        }
        el.style.transition = 'opacity 0.25s, transform 0.25s';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(function(){ loadPosts({ quiet: true }); }, 250);
    }

    // ===== 이모지 교차 리액션 =====
    function renderRxRow(row, p){
        var mine = rxMine[p.id] || {};
        var counts = rxCount[p.id] || {};
        var keys = Object.keys(counts).filter(function(e){ return counts[e] > 0; });

        row.innerHTML = '';
        keys.forEach(function(emo){
            var chip = document.createElement('button');
            chip.className = 'rx-chip' + (mine[emo] ? ' mine' : '');
            chip.disabled = !!rxUnavailable[p.id];
            chip.innerHTML = '<span>' + escapeHtml(emo) + '</span><span class="n">' + counts[emo] + '</span>';
            chip.addEventListener('click', function(ev){
                ev.stopPropagation();
                toggleRx(p, emo, row);
            });
            row.appendChild(chip);
        });

        var add = document.createElement('button');
        add.className = 'rx-add';
        add.textContent = '+';
        add.disabled = !!rxUnavailable[p.id];
        add.title = rxUnavailable[p.id] ? '새로고침해 리액션을 다시 확인해주세요' : '교차 남기기';
        add.setAttribute('aria-label',add.title);
        add.addEventListener('click', function(ev){
            ev.stopPropagation();
            togglePalette(row, p);
        });
        row.appendChild(add);
    }

    async function toggleRx(p, emo, row){
        if(!sb || rxUnavailable[p.id]) return;
        var reactionKey = p.id + ':' + emo;
        if(pendingReactions[reactionKey]) return;
        pendingReactions[reactionKey] = true;
        var mine = rxMine[p.id] = rxMine[p.id] || {};
        var counts = rxCount[p.id] = rxCount[p.id] || {};
        var turningOn = !mine[emo];

        // 낙관적 업데이트 — 실패 시 롤백
        if(turningOn){ mine[emo] = true; counts[emo] = (counts[emo] || 0) + 1; }
        else { delete mine[emo]; counts[emo] = Math.max(0, (counts[emo] || 1) - 1); }
        renderRxRow(row, p);

        // 취소는 REST delete가 아니라 RPC로 한다 — 정책이 관리자에게만 열려 있고,
        // 이 함수가 기기가 일치하는 행만 지운다.
        var res = await writeAction(function(){ return turningOn
            ? sb.from('reactions').insert({ post_id: p.id, emoji: emo, device_id: currentUserId, author_id: currentUserId })
            : sb.rpc('delete_reaction', { p_post_id: p.id, p_emoji: emo, p_device: currentUserId }); });

        delete pendingReactions[reactionKey];
        if(res.error){
            setStatus('리액션을 저장하지 못했어요 — ' + errHint(res.error), true);
            console.error(res.error);
            if(turningOn){ delete mine[emo]; counts[emo] = Math.max(0, counts[emo] - 1); }
            else { mine[emo] = true; counts[emo] = (counts[emo] || 0) + 1; }
            renderRxRow(row, p);
        }
    }

    var openPal = null;
    function closePalette(){ if(openPal){ openPal.remove(); openPal = null; } }
    function togglePalette(row, p){
        if(openPal && openPal.parentNode === row){ closePalette(); return; }
        closePalette();
        var pal = document.createElement('div');
        pal.className = 'rx-palette';
        RX_EMOJIS.forEach(function(emo){
            var b = document.createElement('button');
            b.className = 'rx-pal-btn';
            b.textContent = emo;
            b.addEventListener('click', function(ev){
                ev.stopPropagation();
                closePalette();
                toggleRx(p, emo, row);
            });
            pal.appendChild(b);
        });
        row.appendChild(pal);
        openPal = pal;
    }
    document.addEventListener('click', closePalette);

    // ===== 궤도(채널) 탭 =====
    function renderOrbitTabs(){
        var html = '<button class="orbit-tab' + (currentOrbit==='all'?' on':'') +
                   '" data-orbit="all"><span class="ic">' + ALL_ORBIT.icon + '</span> 전체</button>';
        ORBIT_LIST.forEach(function(o){
            html += '<button class="orbit-tab' + (currentOrbit===o.id?' on':'') + (o.minor?' minor':'') +
                    '" data-orbit="' + o.id + '"><span class="ic">' + o.icon + '</span> ' + escapeHtml(o.label) + '</button>';
        });
        document.getElementById('orbitTabs').innerHTML = html;
    }
    var REFRESH_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>' +
        '<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/>' +
        '</svg>';

    function renderChannelHeader(){
        var o = orbitInfo(currentOrbit);
        document.getElementById('channelHeader').innerHTML =
            '<div class="ch-icon">' + o.icon + '</div>' +
            '<div class="ch-text">' +
            '<div class="ch-name">' + escapeHtml(o.label) + '</div>' +
            '<div class="ch-desc">' + escapeHtml(o.desc) + '</div>' +
            '</div>' +
            '<button class="btn-refresh" type="button" title="새 궤적 불러오기">' +
            REFRESH_ICON + '<span class="rf-lbl">새로고침</span></button>';
    }

    // 헤더는 채널을 바꿀 때마다 다시 그려지므로, 버튼에 직접 걸지 않고 위임한다
    document.getElementById('channelHeader').addEventListener('click', function(e){
        var btn = e.target.closest('.btn-refresh');
        if(!btn || btn.classList.contains('spin')) return;
        btn.classList.add('spin');
        // 최소 한 바퀴는 돌려준다 — 응답이 즉시 와도 "눌리긴 한 건가" 싶지 않게
        var started = Date.now();
        loadPosts({ quiet: true }).then(function(){
            setTimeout(function(){ btn.classList.remove('spin'); },
                       Math.max(0, 700 - (Date.now() - started)));
        });
    });

    function selectOrbit(id){
        currentOrbit = id;
        singlePost = null;
        loadedPosts = []; hasMorePosts = false;
        feedAvailable = false;
        updateFeedLocation();updatePagination();
        document.querySelectorAll('.orbit-tab').forEach(function(t){
            t.classList.toggle('on', t.getAttribute('data-orbit') === id);
        });
        renderChannelHeader();
        var sel = document.getElementById('orbitSelect');
        if(sel && currentOrbit !== 'all') sel.value = currentOrbit; // 보던 방으로 글쓰기 기본값 맞춤
        syncLivePoll();
        loadPosts();
    }

    document.getElementById('feedSearch').addEventListener('submit',function(ev){
        ev.preventDefault();
        var term=document.getElementById('searchInput').value.trim().slice(0,80);
        if(term.includes('*')){setStatus('별표(*)를 제외한 단어로 검색해주세요.',true);return;}
        searchTerm=term;
        selectOrbit(currentOrbit);
    });
    document.getElementById('clearSearch').addEventListener('click',function(){searchTerm='';selectOrbit(currentOrbit);document.getElementById('searchInput').focus();});
    document.getElementById('loadMore').addEventListener('click',function(){loadPosts({more:true});});
    document.getElementById('backToFeed').addEventListener('click',function(ev){ev.preventDefault();searchTerm='';selectOrbit(currentOrbit);});

    document.getElementById('orbitTabs').addEventListener('click', function(e){
        var tab = e.target.closest('.orbit-tab');
        if(!tab) return;
        selectOrbit(tab.getAttribute('data-orbit'));
    });

    // 이미 열린 광장에서 #report 같은 해시 링크를 눌러도 채널이 따라가게
    window.addEventListener('hashchange', function(){
        var o = orbitFromHash();
        if(o && o !== currentOrbit) selectOrbit(o);
    });

    // ===== live 채널 30초 폴링 =====
    // 이름이 "실시간 하늘"이니 이 채널만은 새로고침 없이 새 궤적이 나타나야 한다.
    // 다른 채널까지 폴링하면 요청만 늘어서, 기대를 만들어 둔 채널만 지킨다.
    var livePoll = null;
    function canAutoRefresh(){
        return currentOrbit === 'live' && panelActive && !document.hidden && !feedLoading && !singlePost && !searchTerm && loadedPosts.length <= PAGE_SIZE && !document.querySelector('.rp-back') && !Object.values(commentDrafts).some(function(t){return t.trim();}) && !Object.keys(pendingReactions).length;
    }
    function syncLivePoll(){
        var want = currentOrbit === 'live' && panelActive && !singlePost && !searchTerm;
        if(want && !livePoll){
            livePoll = setInterval(function(){
                if(canAutoRefresh()) loadPosts({ quiet: true });
            }, 30000);
        } else if(!want && livePoll){
            clearInterval(livePoll);
            livePoll = null;
        }
    }
    // 탭을 벗어났다 돌아오면 다음 폴링까지 기다리지 않고 바로 따라잡는다
    document.addEventListener('visibilitychange', function(){
        if(canAutoRefresh()) loadPosts({ quiet: true });
    });

    window.addEventListener('message', function(ev){
        if(ev.origin !== location.origin || ev.source !== parent || !ev.data || ev.data.orbit !== 'panelActive') return;
        var resumed = !panelActive && ev.data.active === true;
        panelActive = ev.data.active === true;
        syncLivePoll();
        if(resumed && canAutoRefresh()) loadPosts({quiet:true});
    });
    if(EMBED) parent.postMessage({orbit:'loungeReady'}, location.origin);

    // ===== 관리자 확인 =====
    // 로그인 세션이 있으면 admins에 등록된 계정인지 서버에 물어본다.
    // 등록돼 있으면 모든 궤적·답에 삭제 버튼이 붙는다.
    // 실패하거나 세션이 없으면 그냥 일반 사용자로 둔다 — 광장은 그대로 동작한다.
    async function checkAdmin(){
        if(!sb || !sb.auth) return false;
        try {
            var s = await sb.auth.getSession();
            if(!s.data || !s.data.session) return false;
            currentUserId = s.data.session.user.id;
            var r = await sb.rpc('is_admin');
            return !r.error && r.data === true;
        } catch(e){ return false; }
    }

    function showAdminBadge(){
        var el = document.getElementById('loungeStatus');
        el.textContent = '🛰️ 관리자 모드 — 모든 궤적과 답을 지울 수 있어요';
        el.style.color = 'var(--mint)';
        el.style.borderColor = 'rgba(79,209,197,0.35)';
        el.style.background = 'rgba(79,209,197,0.08)';
    }

    renderOrbitTabs();
    renderChannelHeader();
    renderWriteCard();
    updateFeedLocation();

    window.addEventListener('beforeunload',function(ev){
        var input=document.getElementById('postInput');
        if((input && input.value.trim()) || Object.values(commentDrafts).some(function(t){return t.trim();})){
            ev.preventDefault();ev.returnValue='';
        }
    });

    // 관리자 확인이 끝난 뒤에 목록을 그린다 — 먼저 그리면 삭제 버튼이 한 박자 늦게 나타난다.
    checkAdmin().then(function(ok){
        isAdmin = ok;
        if(ok) showAdminBadge();
        syncLivePoll();   // 해시로 live에 바로 들어온 경우
        loadPosts();
    });
