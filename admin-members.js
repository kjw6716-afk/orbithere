(function () {
  "use strict";
  window.createOrbitMemberAdmin = function (sb) {
    var panel = document.getElementById("memberEventPanel"),
      generation = 0,
      authorized = false;
    var status = panel.querySelector("[data-event-status]");
    function say(text) {
      status.textContent = text;
    }
    function checked(result) {
      if (result.error) throw result.error;
      return result.data;
    }
    async function load() {
      var token = ++generation;
      try {
        var data = checked(await sb.rpc("member_admin_events"));
        if (token !== generation || !authorized) return;
        var list = panel.querySelector("[data-event-list]"),
          select = panel.querySelector("[name=event]");
        list.replaceChildren();
        select.replaceChildren(new Option("이벤트 선택", ""));
        data.events.forEach(function (e) {
          var row = document.createElement("div"),
            text = document.createElement("p");
          row.className = "account-event";
          text.textContent =
            e.title +
            " · " +
            e.amount +
            " 별빛 · " +
            e.recipients +
            "명" +
            (e.active ? "" : " · 종료");
          row.append(text);
          if (e.active) {
            select.add(new Option(e.title + " (+" + e.amount + ")", e.id));
            var close = document.createElement("button");
            close.type = "button";
            close.className = "secondary";
            close.textContent = "지급 종료";
            close.addEventListener("click", () =>
              operate(close, async () => {
                checked(
                  await sb.rpc("member_close_event", { p_event_id: e.id }),
                );
                await load();
                say("이벤트 지급을 종료했어요.");
              }),
            );
            row.append(close);
          }
          list.append(row);
        });
        if (!data.events.length) list.textContent = "등록된 이벤트가 없어요.";
        var history = panel.querySelector("[data-event-history]");
        history.replaceChildren();
        data.history.forEach(function (r) {
          var row = document.createElement("li"),
            desc = document.createElement("span"),
            points = document.createElement("strong");
          desc.textContent =
            r.nickname +
            " · " +
            r.title +
            " · " +
            new Date(r.created_at).toLocaleDateString("ko-KR", {
              timeZone: "Asia/Seoul",
            });
          points.textContent = "+" + r.amount;
          row.append(desc, points);
          history.append(row);
        });
      } catch (_) {
        if (token === generation)
          say(
            "이벤트를 불러오지 못했어요. 운영자 로그인과 연결을 확인해주세요.",
          );
      }
    }
    async function operate(button, work) {
      if (!authorized || button.disabled) return;
      button.disabled = true;
      try {
        await work();
      } catch (_) {
        say("처리하지 못했어요. 회원 닉네임·이벤트 상태·연결을 확인해주세요.");
      } finally {
        button.disabled = false;
      }
    }
    panel
      .querySelector("[data-event-create]")
      .addEventListener("submit", function (e) {
        e.preventDefault();
        var form = this;
        operate(form.querySelector("button"), async () => {
          checked(
            await sb.rpc("member_create_event", {
              p_title: form.elements.title.value.trim(),
              p_amount: Number(form.elements.amount.value),
            }),
          );
          form.reset();
          await load();
          say("이벤트를 등록했어요.");
        });
      });
    panel
      .querySelector("[data-event-award]")
      .addEventListener("submit", function (e) {
        e.preventDefault();
        var form = this;
        operate(form.querySelector("button"), async () => {
          var awarded = checked(
            await sb.rpc("member_award_event", {
              p_event_id: form.elements.event.value,
              p_nickname: form.elements.nickname.value.trim(),
            }),
          );
          await load();
          say(
            awarded
              ? "별빛을 지급했어요."
              : "이 회원에게 이미 지급한 이벤트예요. 중복 지급하지 않았습니다.",
          );
        });
      });
    return {
      setAuthorized(on) {
        authorized = on && !!window.ORBIT_CONFIG.membersEnabled;
        ++generation;
        panel.hidden = !authorized;
        if (authorized) load();
        else {
          panel.querySelector("[data-event-list]").replaceChildren();
          panel.querySelector("[data-event-history]").replaceChildren();
          say("");
        }
      },
    };
  };
})();
