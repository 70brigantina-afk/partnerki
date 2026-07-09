export const captureUtmScript = `
(function () {
  var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  var params = new URLSearchParams(window.location.search);
  var utm = {};
  var has = false;
  keys.forEach(function (k) {
    var v = params.get(k);
    if (v) { utm[k] = v; has = true; }
  });
  if (has) {
    try { sessionStorage.setItem('navigator_utm', JSON.stringify(utm)); } catch (e) {}
  }
})();
`;
