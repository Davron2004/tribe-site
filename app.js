// Shared helpers for the Members and Events pages: fetch a published Sheet
// as CSV, parse it, and render it. Sheet text is untrusted (anyone with the
// passcode can type into the form), so it only ever goes in via textContent.
(function () {
  const cfg = window.TRIBE_CONFIG;

  // RFC 4180 CSV: handles quoted fields with commas, quotes ("") and line breaks.
  // Returns one object per row, keyed by the lowercased header names.
  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const keys = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    return rows.map((r) => Object.fromEntries(keys.map((k, j) => [k, (r[j] || "").trim()])));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function link(text, href) {
    const a = el("a", "", text);
    a.href = href;
    if (!href.startsWith("mailto:")) { a.target = "_blank"; a.rel = "noopener"; }
    return a;
  }

  // Organizers may type "example.com" without a scheme; anything else that
  // isn't http(s) becomes a harmless https:// link rather than e.g. javascript:.
  function webUrl(value) {
    return !value ? "" : /^https?:\/\//i.test(value) ? value : "https://" + value;
  }

  // Plain text with every http(s) URL turned into a link element.
  function linkify(text) {
    const out = document.createDocumentFragment();
    text.split(/(https?:\/\/[^\s<>"]+)/).forEach((part, i) => {
      if (i % 2 === 0) return out.append(part);
      const url = part.replace(/[.,;:!?)\]'"]+$/, ""); // trailing punctuation isn't part of the URL
      out.append(link(url, url), part.slice(url.length));
    });
    return out;
  }

  // A Drive share link ("drive.google.com/file/d/<id>/view?...") opens a viewer
  // page, not an image; Drive's thumbnail endpoint serves the image itself.
  // Any other URL is used as is.
  function photoUrl(value) {
    const id = (value.match(/drive\.google\.com\/.*?(?:\/d\/|[?&]id=)([\w-]+)/) || [])[1];
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : value;
  }

  // Initials circle; if the row has a photo_url that loads, the photo replaces them.
  function avatar(member) {
    const words = member.name.split(/\s+/);
    const node = el("span", "avatar", (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase());
    if (member.photo_url) {
      const img = new Image();
      img.alt = "";
      img.onload = () => node.replaceChildren(img);
      img.src = photoUrl(member.photo_url);
    }
    return node;
  }

  // "2026-11-05" -> "Thu, Nov 5, 2026" (in UTC, so the day never shifts).
  function formatDate(iso) {
    const date = new Date(iso + "T00:00:00Z");
    return isNaN(date) ? iso : date.toLocaleDateString("en-US",
      { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  // Fills `list` with one rendered item per kept row, and turns the #status
  // paragraph into the empty or error message as needed.
  async function showList(list, url, keep, render, noun, emptyText) {
    const status = document.getElementById("status");
    try {
      const res = await fetch(url);
      // A misconfigured Sheet returns an HTML page (e.g. a sign-in page) with status 200.
      if (!res.ok || !/csv/.test(res.headers.get("content-type"))) throw new Error(res.status + " " + url);
      const rows = parseCsv(await res.text()).filter(keep);
      list.append(...rows.map(render));
      if (rows.length) status.remove();
      else status.textContent = emptyText;
    } catch (err) {
      console.error(err);
      status.textContent = `Couldn't load ${noun}, please try again later.`;
      status.classList.add("error");
      status.setAttribute("role", "alert");
    }
  }

  // Dialogs close with the X (a form[method=dialog] button), Escape (native),
  // or a click on the backdrop, which targets the <dialog> element itself.
  document.querySelectorAll("dialog").forEach((dialog) =>
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }));

  const members = document.getElementById("members");
  if (members) {
    const dialog = document.getElementById("member");
    const open = (m) => {
      const links = el("p", "links");
      if (m.email) links.append(link("Email", "mailto:" + m.email));
      if (m.linkedin) links.append(link("LinkedIn", webUrl(m.linkedin)));
      if (m.website) links.append(link("Website", webUrl(m.website)));
      dialog.querySelector(".body").replaceChildren(
        avatar(m),
        el("h2", "name", m.name),
        el("p", "meta", [m.title, m.company].filter(Boolean).join(", ")),
        el("p", "bio", m.full_bio || m.short_description),
        ...(links.children.length ? [links] : []));
      dialog.showModal();
    };
    showList(members, cfg.membersCsvUrl,
      (m) => m.name && (m.active || "").toLowerCase() !== "no",
      (m) => {
        const card = el("button", "card");
        card.type = "button";
        card.append(avatar(m), el("span", "name", m.name), el("span", "meta", m.company), el("span", "desc", m.short_description));
        card.addEventListener("click", () => open(m));
        const li = el("li");
        li.append(card);
        return li;
      },
      "members", "No members yet.");
  }

  const events = document.getElementById("events");
  if (events) {
    // The Sheet's formula already returns only upcoming events, in date order.
    showList(events, cfg.eventsCsvUrl, (e) => e.event_name, (e) => {
      const li = el("li", "event");
      const date = el("time", "date", formatDate(e.date));
      date.dateTime = e.date;
      const desc = el("p", "desc");
      desc.append(linkify(e.description || ""));
      li.append(date, el("h2", "name", e.event_name), desc);
      if (e.submitted_by) li.append(el("p", "by", "Added by " + e.submitted_by));
      return li;
    }, "events", "No upcoming events.");

    const dialog = document.getElementById("event-form");
    const frame = dialog.querySelector("iframe");
    dialog.querySelector(".fine a").href = cfg.eventFormUrl;
    document.getElementById("add-event").addEventListener("click", () => {
      if (!frame.src) {
        const url = new URL(cfg.eventFormUrl, location.href);
        url.searchParams.set("embedded", "true");
        frame.src = url.href;
      }
      dialog.showModal();
    });
  }
})();
