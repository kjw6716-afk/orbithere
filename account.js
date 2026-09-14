(function () {
  "use strict";
  var member = window.OrbitMembers,
    sb = member.sb,
    $ = function (id) {
      return document.getElementById(id);
    };
  var mode =
      new URLSearchParams(location.search).get("mode") === "signup"
        ? "signup"
        : "login",
    recovery =
      location.hash.includes("type=recovery") ||
      new URLSearchParams(location.search).get("flow") === "recovery",
    pending = false,
    editing = false;
  var callback = location.origin + location.pathname;
  function say(text) {
    $("accountStatus").textContent = text;
  }
  function show(id, on) {
    $(id).hidden = !on;
  }
  function checked(result) {
    if (result.error) throw result.error;
    return result.data;
  }
  function errorText(error) {
    var code = error && error.code,
      message = String((error && error.message) || "");
    if (code === "23505")
      return "이미 사용 중인 닉네임이에요. 다른 이름을 정해주세요.";
    if (/withdrawal_in_progress/.test(message))
      return "탈퇴 처리가 진행 중이에요. 아래 회원 탈퇴에서 다시 시도하면 남은 삭제를 이어갑니다.";
    if (/admin_transfer_required/.test(message))
      return "운영자 계정은 권한 이전 후 탈퇴할 수 있어요.";
    if (/over_email_send_rate_limit|over_request_rate_limit/.test(code || ""))
      return "요청이 많아요. 잠시 기다린 뒤 다시 시도해주세요.";
    if (/email_address_not_authorized|email_provider_disabled/.test(code || ""))
      return "가입 메일 발송을 준비하고 있어요. 잠시 후 다시 시도해주세요.";
    if (
      /identity_already_exists|email_exists|user_already_exists/.test(
        code || "",
      )
    )
      return "이 이메일을 연결할 수 없어요. 이미 가입했다면 로그인 메뉴를 이용해주세요. 기존 익명 활동은 자동 합쳐지지 않습니다.";
    if (/23514|22023/.test(code || ""))
      return "닉네임과 입력한 내용을 확인해주세요.";
    if (/invalid_credentials|email_not_confirmed/.test(code || ""))
      return "이메일·비밀번호와 이메일 인증 여부를 확인해주세요.";
    return "처리하지 못했어요. 연결과 입력 내용을 확인한 뒤 다시 시도해주세요.";
  }
  async function run(work) {
    if (pending) return;
    pending = true;
    document.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await work();
    } catch (error) {
      say(errorText(error));
    } finally {
      pending = false;
      document.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  }
  function setMode(next) {
    mode = next;
    var anon = member.state.user && member.state.user.is_anonymous;
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
      );
    $("authTitle").textContent = {
      login: "다시 만나 반가워요",
      signup: anon ? "지금의 활동을 계정에 연결하기" : "오빗 회원가입",
      reset: "비밀번호 찾기",
    }[mode];
    $("authHelp").textContent =
      mode === "signup"
        ? anon
          ? "이 브라우저의 익명 계정에 이메일을 연결해요. 이메일 인증을 마친 뒤 비밀번호를 설정하면 기존 글의 작성 권한이 이어집니다."
          : "이메일 인증을 마치면 닉네임과 프로필을 정할 수 있어요."
        : mode === "login" && anon
          ? "다른 기존 계정으로 로그인하면 현재 익명 계정의 활동은 합쳐지지 않아요. 지금 활동을 보관하려면 회원가입에서 이메일을 연결해주세요."
          : "";
    var password = mode === "login" || (mode === "signup" && !anon);
    show("passwordField", password);
    $("password").required = password;
    $("password").minLength = mode === "login" ? 1 : 12;
    $("password").autocomplete =
      mode === "login" ? "current-password" : "new-password";
    show("signupConsent", mode === "signup");
    $("consent").required = mode === "signup";
    $("authSubmit").textContent = {
      login: "로그인",
      signup: "가입 인증메일 받기",
      reset: "재설정 메일 받기",
    }[mode];
  }
  function render() {
    var s = member.state,
      u = s.user,
      registered = u && !u.is_anonymous && u.email_confirmed_at;
    show("authCard", !registered);
    show("sessionCard", registered);
    var needsPassword =
      registered &&
      (recovery || (u.user_metadata && u.user_metadata.orbit_needs_password));
    show("passwordCard", needsPassword);
    show(
      "setupCard",
      registered && !needsPassword && (!s.profile || editing) && !s.error,
    );
    show("profileCard", registered && !needsPassword && !!s.profile);
    setMode(mode);
    if (!registered) return;
    if (s.error) {
      say(errorText(s.error));
      return;
    }
    if (!s.profile) {
      $("memberNickname").value = localStorage.getItem("orbit_nickname") || "";
      return;
    }
    var p = s.profile;
    $("profileEmail").textContent = u.email;
    $("profileNickname").textContent = p.nickname;
    $("profileLevel").textContent = "Lv." + p.level;
    $("totalXp").textContent = p.xp.toLocaleString("ko-KR");
    $("totalDays").textContent = p.attendance_days + "일";
    $("levelProgress").max = p.next_level - p.level_start;
    $("levelProgress").value = p.xp - p.level_start;
    $("levelProgressText").textContent =
      "다음 레벨까지 " + (p.next_level - p.xp) + " 별빛";
    $("attendanceStatus").textContent = p.today_claimed
      ? "오늘 출석 완료 · 별빛 10을 받았어요."
      : "오늘의 출석을 확인하고 있어요.";
    $("selectedBadge").replaceChildren(new Option("표시하지 않음", ""));
    p.badges.forEach((b) => {
      if (member.badges[b])
        $("selectedBadge").add(new Option(member.badges[b], b));
    });
    $("selectedBadge").value = p.selected_badge || "";
    $("rewardHistory").replaceChildren();
    p.history.forEach((r) => {
      var row = document.createElement("li"),
        desc = document.createElement("span"),
        time = document.createElement("time"),
        amount = document.createElement("strong");
      desc.textContent =
        r.kind === "visit"
          ? "하루 첫 접속"
          : r.kind === "first-post"
            ? "첫 글"
            : r.title || "이벤트";
      time.dateTime = r.created_at;
      time.textContent = new Date(r.created_at).toLocaleDateString("ko-KR", {
        timeZone: "Asia/Seoul",
      });
      desc.append(time);
      amount.textContent = "+" + r.amount;
      row.append(desc, amount);
      $("rewardHistory").append(row);
    });
  }
  document.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      setMode(b.dataset.mode);
      say("");
    }),
  );
  $("authForm").addEventListener("submit", function (e) {
    e.preventDefault();
    run(async () => {
      if (!window.ORBIT_CONFIG.membersEnabled) throw new Error("not_ready");
      var email = $("email").value.trim(),
        password = $("password").value;
      if (mode === "login") {
        checked(await sb.auth.signInWithPassword({ email, password }));
        $("password").value = "";
        await member.refresh();
        say("로그인했어요.");
      }
      if (mode === "signup") {
        // Re-read the active identity immediately before linking; never overwrite a registered user's email.
        var session = checked(await sb.auth.getSession()).session;
        if (session && !session.user.is_anonymous)
          throw new Error("session_changed");
        if (session)
          checked(
            await sb.auth.updateUser(
              { email, data: { orbit_needs_password: true } },
              { emailRedirectTo: callback },
            ),
          );
        else
          checked(
            await sb.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: callback },
            }),
          );
        $("password").value = "";
        say(
          "입력한 주소로 인증메일을 요청했어요. 받은 메일의 링크를 열어 가입을 마쳐주세요. 메일이 없으면 스팸함과 가입 여부를 확인해주세요.",
        );
      }
      if (mode === "reset") {
        checked(
          await sb.auth.resetPasswordForEmail(email, {
            redirectTo: callback + "?flow=recovery",
          }),
        );
        say(
          "재설정 메일을 요청했어요. 가입한 주소라면 받은 메일의 링크에서 새 비밀번호를 정해주세요.",
        );
      }
    });
  });
  $("profileForm").addEventListener("submit", function (e) {
    e.preventDefault();
    run(async () => {
      var nickname = $("memberNickname").value.trim();
      checked(
        await sb.rpc("member_save_profile", {
          p_nickname: nickname,
          p_policy_version: "2026-09-14-members",
        }),
      );
      editing = false;
      await member.refresh();
      say("프로필을 저장했어요.");
    });
  });
  $("editProfile").addEventListener("click", () => {
    editing = true;
    render();
    $("memberNickname").value = member.state.profile.nickname;
    $("profileConsent").checked = true;
    $("memberNickname").focus();
  });
  $("saveBadge").addEventListener("click", () =>
    run(async () => {
      checked(
        await sb.rpc("member_select_badge", {
          p_badge: $("selectedBadge").value || null,
        }),
      );
      await member.refresh();
      say("배지를 저장했어요.");
    }),
  );
  $("newPasswordForm").addEventListener("submit", function (e) {
    e.preventDefault();
    run(async () => {
      if ($("newPassword").value !== $("confirmPassword").value) {
        say("새 비밀번호가 서로 달라요.");
        return;
      }
      checked(
        await sb.auth.updateUser({
          password: $("newPassword").value,
          data: { orbit_needs_password: false },
        }),
      );
      $("newPasswordForm").reset();
      recovery = false;
      history.replaceState(null, "", location.pathname);
      await member.refresh();
      say("비밀번호를 저장했어요.");
    });
  });
  $("changePassword").addEventListener("click", () => {
    recovery = true;
    render();
    $("newPassword").focus();
  });
  $("signOut").addEventListener("click", () =>
    run(async () => {
      checked(await sb.auth.signOut());
      member.clearNickname();
      editing = false;
      recovery = false;
      await member.refresh();
      say("로그아웃했어요.");
    }),
  );
  $("withdrawForm").addEventListener("submit", function (e) {
    e.preventDefault();
    run(async () => {
      var original = member.state.user;
      if (
        !original ||
        !confirm("계정과 작성한 글·댓글·사진·별빛을 영구 삭제할까요?")
      )
        return;
      var data = checked(
        await sb.auth.signInWithPassword({
          email: original.email,
          password: $("withdrawPassword").value,
        }),
      );
      $("withdrawPassword").value = "";
      if (data.user.id !== original.id) throw new Error("session_changed");
      say("계정과 활동을 삭제하고 있어요. 이 화면을 닫지 말아주세요.");
      var response = await sb.functions.invoke("member-withdraw", {
        body: { confirmation: "DELETE_MY_ACCOUNT" },
      });
      if (response.error) {
        var reason;
        try {
          reason = await response.error.context.json();
        } catch (_) {}
        throw new Error((reason && reason.error) || "withdrawal_failed");
      }
      if (!response.data || !response.data.deleted)
        throw new Error("withdrawal_failed");
      await sb.auth.signOut({ scope: "local" });
      member.clearNickname();
      await member.refresh();
      say("회원 탈퇴와 활동 삭제를 마쳤어요.");
    });
  });
  window.addEventListener("orbit:member", render);
  if (!sb || !window.ORBIT_CONFIG.membersEnabled) {
    say(
      "회원 기능을 준비하고 있어요. 준비가 끝나면 이곳에서 가입할 수 있습니다.",
    );
    return;
  }
  sb.auth.onAuthStateChange(function (event) {
    if (event === "PASSWORD_RECOVERY") {
      recovery = true;
      setTimeout(render, 0);
    }
  });
  member.refresh().then(() => {
    if (!member.state.error) say("");
    render();
  });
})();
