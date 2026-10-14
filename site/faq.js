/* FAQ: every question has its own link (e.g. #faq-when-open). Opening a link
   to a question opens that answer; opening a question puts its link in the
   address bar, ready to copy and share. */
(() => {
  const openFromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const item = id && document.getElementById(id);
    if (item && item.tagName === 'DETAILS') { item.open = true; item.scrollIntoView({block: 'start'}); }
  };
  document.querySelectorAll('.faq details').forEach(item => item.addEventListener('toggle', () => {
    if (item.open && location.hash !== '#' + item.id) history.replaceState(null, '', '#' + item.id);
  }));
  addEventListener('hashchange', openFromHash);
  openFromHash();

  // The web font arrives after first paint and re-wraps the text above the FAQ,
  // which pushes a linked answer down the page. Line it up again once fonts and
  // images have loaded, unless the reader has already started scrolling.
  let readerMoved = false;
  for (const type of ['wheel', 'touchstart', 'keydown']) addEventListener(type, () => { readerMoved = true; }, {once: true, passive: true});
  const settle = () => { if (!readerMoved) openFromHash(); };
  if (document.fonts) document.fonts.ready.then(settle);
  addEventListener('load', settle);
})();
