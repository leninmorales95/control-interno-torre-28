/*
 * TORRE 28 - Puente google.script.run -> API HTTP
 *
 * Permite conservar app.js y su lógica visual prácticamente intactos.
 * Cada llamada antigua como:
 *
 * google.script.run
 *   .withSuccessHandler(...)
 *   .withFailureHandler(...)
 *   .guardarDirectorioWeb(datos);
 *
 * se convierte automáticamente en:
 * Netlify -> T28Api.rpc() -> Apps Script -> función permitida.
 */
(function () {
  function crearRunner(successHandler, failureHandler) {
    const runner = new Proxy({}, {
      get(_target, prop) {
        if (prop === "withSuccessHandler") {
          return function (fn) {
            return crearRunner(
              typeof fn === "function" ? fn : null,
              failureHandler
            );
          };
        }

        if (prop === "withFailureHandler") {
          return function (fn) {
            return crearRunner(
              successHandler,
              typeof fn === "function" ? fn : null
            );
          };
        }

        if (prop === "then" || prop === "catch") {
          return undefined;
        }

        return function (...args) {
          if (!window.T28Api || typeof window.T28Api.rpc !== "function") {
            const err = new Error("Cliente API de Torre 28 no disponible.");
            if (failureHandler) setTimeout(() => failureHandler(err), 0);
            else console.error(err);
            return;
          }

          window.T28Api.rpc(String(prop), args)
            .then(function (res) {
              if (successHandler) successHandler(res ? res.data : undefined);
            })
            .catch(function (err) {
              if (failureHandler) failureHandler(err);
              else console.error("[T28 API]", String(prop), err);
            });
        };
      }
    });

    return runner;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = crearRunner(null, null);
})();
