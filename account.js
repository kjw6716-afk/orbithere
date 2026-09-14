(function () {
  "use strict";
  window.mountOrbitAccount = function (root, initial) {
  initial = initial || {};
  var member = window.OrbitMembers,
    sb = member.sb,
    $ = function (id) {
      return root.querySelector("#" + id);
    };
  var mode =
      initial.mode === "signup"
        ? "signup"
        : "login",
    recovery =
      initial.flow === "recovery",
    pending = false,
    editing = false,
    verification = null;
  var callback = location.origin + "/account.html";
  var policyVersion = "2026-09-14-members",
    googleReturnKey = "orbit_google_return";
  var googleWithdrawalUserId = null,
    googleReturnHandled = false;
  function googleOnly(user) {
    var providers = (user &&
      user.app_metadata &&
      user.app_metadata.providers) || [
      user && user.app_metadata && user.app_metadata.provider,
    ];
    return providers.includes("google") && !providers.includes("email");
  }
  function clearGoogleReturn() {
    sessionStorage.removeItem(googleReturnKey);
    googleWithdrawalUserId = null;
  }
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
    if (/nickname_cooldown/.test(message))
      return "닉네임은 마지막 저장 후 30일이 지나야 바꿀 수 있어요.";
    if (code === "otp_expired")
      return "인증번호가 다르거나 만료됐어요. 번호를 확인하거나 다시 받아주세요.";
    if (code === "weak_password")
      return "비밀번호는 6자 이상으로 입력해주세요.";
    if (/withdrawal_in_progress/.test(message))
      return "탈퇴 처리가 진행 중이에요. 아래 회원 탈퇴에서 다시 시도하면 남은 삭제를 이어갑니다.";
    if (/admin_transfer_required/.test(message))
      return "운영자 계정은 권한 이전 후 탈퇴할 수 있어요.";
    if (
      /manual_linking_disabled|provider_disabled|unsupported_provider/.test(
        code || message,
      )
    )
      return "Google 로그인을 준비하고 있어요. 이메일 가입을 이용하거나 잠시 후 다시 시도해주세요.";
    if (/reauthentication_required/.test(message))
      return "본인 확인 시간이 지났어요. 다시 인증한 뒤 탈퇴를 진행해주세요.";
    if (/session_changed/.test(message))
      return "다른 계정으로 로그인되어 삭제하지 않았어요. 탈퇴하려던 계정으로 다시 로그인해주세요.";
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
    root.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await work();
    } catch (error) {
      say(errorText(error));
    } finally {
      pending = false;
      root.querySelectorAll("button").forEach((b) => (b.disabled = false));
      updateControls();
    }
  }
  function nicknameLocked() {
    var p = member.state.profile;
    return !!p && Date.parse(p.nickname_change_available_at) > Date.now();
  }
  function updateControls() {
    $("editProfile").disabled = pending || nicknameLocked();
    if (!verification) return;
    var left = Math.max(0, Math.ceil((verification.expiresAt - Date.now()) / 1000));
    $("verifyExpiry").textContent = left
      ? "남은 시간 " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0")
      : "인증 시간이 지났어요. 인증번호를 다시 받아주세요.";
    $("verifySubmit").disabled = pending || !left;
    var wait = Math.max(0, Math.ceil((verification.resendAt - Date.now()) / 1000));
    $("resendCode").disabled = pending || !!wait;
    $("resendCode").textContent = wait ? "다시 받기 (" + wait + "초)" : "인증번호 다시 받기";
  }
  function beginVerification(email, type, userId, sentAt) {
    verification = { email: email, type: type, userId: userId, expiresAt: sentAt + 300000, resendAt: sentAt + 60000 };
    $("verifyEmail").textContent = email;
    $("emailCode").value = "";
    render();
    say("");
    $("emailCode").focus();
  }
  async function checkVerificationSession() {
    var session = checked(await sb.auth.getSession()).session;
    if ((verification.userId && (!session || session.user.id !== verification.userId)) ||
        (session && !session.user.is_anonymous)) throw new Error("session_changed");
  }
  function setMode(next) {
    mode = next;
    var anon = member.state.user && member.state.user.is_anonymous;
    root
      .querySelectorAll("[data-mode]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
      );
    $("authTitle").textContent = {
      login: "로그인",
      signup: "회원가입",
      reset: "비밀번호 찾기",
    }[mode];
    $("authHelp").textContent =
      mode === "signup"
        ? anon
          ? "기존 글은 가입한 계정에 이어집니다."
          : "이메일 인증 후 닉네임을 정해주세요."
        : mode === "login" && anon
          ? "기존 비회원 글을 이어가려면 회원가입을 선택해주세요."
          : "";
    root.querySelector(".account-tabs").hidden = mode === "reset";
    show('resetBack', mode === 'reset');
    show('resetLink', mode !== 'reset');
    $("accountPanelTitle").textContent = mode === "reset" ? "비밀번호 찾기" : "궤도 진입하기";
    var password = mode === "login" || (mode === "signup" && !anon);
    show("passwordField", password);
    $("password").required = password;
    $("password").minLength = mode === "login" ? 1 : 6;
    $("password").autocomplete =
      mode === "login" ? "current-password" : "new-password";
    show("signupConsent", mode === "signup");
    show(
      "googleAuth",
      !!window.ORBIT_CONFIG.googleAuthEnabled && mode !== "reset",
    );
    $("consent").required = mode === "signup";
    $("authSubmit").textContent = {
      login: "로그인",
      signup: "인증번호 받기",
      reset: "재설정 메일 받기",
    }[mode];
  }
  function render() {
    var s = member.state,
      u = s.user,
      registered = u && !u.is_anonymous && u.email_confirmed_at;
    if (!u || googleWithdrawalUserId !== u.id) googleWithdrawalUserId = null;
    if (registered) verification = null;
    show("authCard", !registered && !verification);
    show("verifyCard", !registered && !!verification);
    show("sessionCard", registered);
    var needsPassword =
      registered &&
      !googleOnly(u) &&
      (recovery || (u.user_metadata && u.user_metadata.orbit_needs_password));
    show("passwordCard", needsPassword);
    show(
      "setupCard",
      registered && !needsPassword && (!s.profile || editing) && !s.error,
    );
    show(
      "profileCard",
      registered && !needsPassword && !!s.profile && !editing,
    );
    setMode(mode);
    updateControls();
    if (verification) $("accountPanelTitle").textContent = "이메일 인증";
    if (!registered) return;
    $("accountPanelTitle").textContent = "내 계정";
    var google = googleOnly(u);
    show("changePassword", !google);
    show("googleManage", google);
    show("withdrawPasswordField", !google);
    show("googleWithdrawHelp", google);
    $("withdrawPassword").required = !google;
    $("withdrawForm").querySelector("button").textContent =
      google && googleWithdrawalUserId !== u.id
        ? "Google로 본인 확인"
        : "내 계정과 활동 삭제";
    show("editProfile", !!s.profile);
    show("nicknameChangeHelp", !!s.profile && nicknameLocked());
    if (s.profile && nicknameLocked())
      $("nicknameChangeHelp").textContent = "닉네임 변경 가능: " + new Date(s.profile.nickname_change_available_at).toLocaleString("ko-KR", {timeZone:"Asia/Seoul",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
    var accepted =
      !!s.profile ||
      (u.user_metadata &&
        u.user_metadata.orbit_policy_version === policyVersion);
    show("profileConsentField", !accepted);
    if (accepted) $("profileConsent").checked = true;
    if (s.error) {
      say(errorText(s.error));
      return;
    }
    if (!s.profile) {
      $("memberNickname").value = localStorage.getItem("orbit_nickname") || "";
      return;
    }
    var p = s.profile;
    $("profileNickname").textContent = p.nickname;
    $("profileLevel").textContent = "Lv." + p.level;
    $("levelProgress").max = p.next_level - p.level_start;
    $("levelProgress").value = p.xp - p.level_start;
    $("levelProgressText").textContent =
      "다음 레벨까지 " + (p.next_level - p.xp) + " 별빛";
    var joined = new Date(p.joined_at);
    $("profileJoined").textContent = Number.isNaN(joined.getTime())
      ? "—"
      : joined.toLocaleDateString("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
    if (!Number.isNaN(joined.getTime()))
      $("profileJoined").dateTime = p.joined_at;
  }
  root.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      setMode(b.dataset.mode);
      say("");
    }),
  );
  $("googleSignIn").addEventListener("click", () =>
    run(async () => {
      if (
        !window.ORBIT_CONFIG.membersEnabled ||
        !window.ORBIT_CONFIG.googleAuthEnabled
      )
        throw new Error("provider_disabled");
      clearGoogleReturn();
      var session = checked(await sb.auth.getSession()).session;
      if (session && !session.user.is_anonymous)
        throw new Error("session_changed");
      var options = {
        redirectTo: callback,
        queryParams: { prompt: "select_account" },
      };
      if (mode === "signup" && session)
        checked(await sb.auth.linkIdentity({ provider: "google", options }));
      else
        checked(await sb.auth.signInWithOAuth({ provider: "google", options }));
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
        var sentAt = Date.now();
        // Re-read the active identity immediately before linking; never overwrite a registered user's email.
        var session = checked(await sb.auth.getSession()).session;
        if (session && !session.user.is_anonymous)
          throw new Error("session_changed");
        if (session)
          checked(
            await sb.auth.updateUser(
              {
                email,
                data: {
                  orbit_needs_password: true,
                  orbit_policy_version: policyVersion,
                },
              },
              { emailRedirectTo: callback },
            ),
          );
        else
          checked(
            await sb.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: callback,
                data: { orbit_policy_version: policyVersion },
              },
            }),
          );
        $("password").value = "";
        beginVerification(email, session ? "email_change" : "signup", session ? session.user.id : null, sentAt);
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
  $("verifyForm").addEventListener("submit", function (event) {
    event.preventDefault();
    run(async function () {
      if (!verification) return;
      if (Date.now() >= verification.expiresAt) { updateControls(); return; }
      await checkVerificationSession();
      var data = checked(await sb.auth.verifyOtp({ email: verification.email, token: $("emailCode").value.trim(), type: verification.type }));
      $("emailCode").value = "";
      if (!data.session || !data.user || data.user.is_anonymous || !data.user.email_confirmed_at)
        throw new Error("verification_incomplete");
      verification = null;
      await member.refresh();
      say("이메일 인증을 마쳤어요.");
    });
  });
  $("resendCode").addEventListener("click", function () {
    run(async function () {
      if (!verification || Date.now() < verification.resendAt) return;
      await checkVerificationSession();
      var target = verification, sentAt = Date.now();
      checked(await sb.auth.resend({ type: target.type, email: target.email }));
      beginVerification(target.email, target.type, target.userId, sentAt);
    });
  });
  $("verifyBack").addEventListener("click", function () {
    verification = null;
    mode = "signup";
    $("emailCode").value = "";
    render();
    say("");
    $("email").focus();
  });
  $("profileForm").addEventListener("submit", function (e) {
    e.preventDefault();
    run(async () => {
      var nickname = $("memberNickname").value.trim();
      checked(
        await sb.rpc("member_save_profile", {
          p_nickname: nickname,
          p_policy_version: policyVersion,
        }),
      );
      editing = false;
      await member.refresh();
      say("프로필을 저장했어요.");
    });
  });
  $("editProfile").addEventListener("click", () => {
    if (nicknameLocked()) return;
    editing = true;
    render();
    $("memberNickname").value = member.state.profile
      ? member.state.profile.nickname
      : localStorage.getItem("orbit_nickname") || "";
    $("profileConsent").checked = true;
    $("memberNickname").focus();
  });
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
      clearGoogleReturn();
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
      if (!original) return;
      if (googleOnly(original) && googleWithdrawalUserId !== original.id) {
        sessionStorage.setItem(
          googleReturnKey,
          JSON.stringify({ userId: original.id, startedAt: Date.now() }),
        );
        checked(
          await sb.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: callback + "?flow=google-withdraw",
              queryParams: { prompt: "select_account" },
            },
          }),
        );
        return;
      }
      if (
        !original ||
        !confirm("계정과 작성한 글·댓글·사진·별빛을 영구 삭제할까요?")
      )
        return;
      var data = googleOnly(original)
        ? checked(await sb.auth.getUser())
        : checked(
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
        googleWithdrawalUserId = null;
        render();
        var reason;
        try {
          reason = await response.error.context.json();
        } catch (_) {}
        throw new Error((reason && reason.error) || "withdrawal_failed");
      }
      if (!response.data || !response.data.deleted)
        throw new Error("withdrawal_failed");
      await sb.auth.signOut({ scope: "local" });
      clearGoogleReturn();
      member.clearNickname();
      await member.refresh();
      say("회원 탈퇴와 활동 삭제를 마쳤어요.");
    });
  });
  async function handleGoogleReturn() {
    if (
      googleReturnHandled ||
      initial.flow !== "google-withdraw"
    )
      return;
    googleReturnHandled = true;
    var saved;
    try {
      saved = JSON.parse(sessionStorage.getItem(googleReturnKey));
    } catch (_) {}
    sessionStorage.removeItem(googleReturnKey);

    var user = checked(await sb.auth.getUser()).user;
    if (
      !saved ||
      !Number.isFinite(saved.startedAt) ||
      !user ||
      user.id !== saved.userId ||
      !googleOnly(user) ||
      Date.now() - saved.startedAt > 15 * 60 * 1000 ||
      saved.startedAt > Date.now()
    ) {
      googleWithdrawalUserId = null;
      say(
        "계정 확인을 완료하지 못해 삭제하지 않았어요. 탈퇴하려던 계정에서 다시 시도해주세요.",
      );
      return;
    }
    googleWithdrawalUserId = user.id;
    render();
    $("withdrawDetails").open = true;
    $("withdrawConsent").checked = false;
    say(
      "Google 계정을 확인했어요. 삭제할 내용을 다시 확인한 뒤 탈퇴를 완료해주세요.",
    );
    $("withdrawDetails").scrollIntoView({ block: "nearest" });
  }
  window.addEventListener("orbit:member", render);
  setInterval(function () { if (root.open) updateControls(); }, 1000);
  if (!sb || !window.ORBIT_CONFIG.membersEnabled) {
    say(
      "회원 기능을 준비하고 있어요. 준비가 끝나면 이곳에서 가입할 수 있습니다.",
    );
    return {mode:function(){},isBusy:function(){return false;},clearSecrets:function(){}};
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
    var oauthError = initial.flow === "oauth-error";
    if (oauthError) {
      clearGoogleReturn();

      say(
        "Google 로그인을 완료하지 못했어요. 취소했거나 연결에 문제가 생겼다면 다시 시도해주세요.",
      );
      return;
    }
    handleGoogleReturn().catch((error) => say(errorText(error)));
  });
  return {
    mode: function (next) { setMode(next === "signup" ? "signup" : "login"); say(""); },
    isBusy: function () { return pending; },
    clearSecrets: function () {
      editing = false;
      root.querySelectorAll('input[type="password"]').forEach(function (input) { input.value = ""; });
      $("emailCode").value = "";
      $("withdrawConsent").checked = false;
      $("withdrawDetails").open = false;
      render();
    }
  };
  };
})();
