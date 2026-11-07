/* The website's data files (/data/*.json, same origin as the game page), each
 * fetched once per page load, the gzipped copy first where the site has one.
 * The area index and the item files have none (nginx gzips them on the fly),
 * so they are fetched plain straight away. The
 * help index and bodies come from the help search, which already loads them. */
export { loadIndex, loadBodies, label as helpLabel } from '../components/windowletsPanel/helpSearch';

const cache = {};

function fetchPlain(name) {
  return fetch('/data/' + name).then(r => {
    if (!r.ok) throw new Error(name);
    return r.json();
  });
}

const NO_GZ = /^(maps-index|db_[a-z]+)\.json$/;

export function loadData(name) {
  if (!cache[name]) {
    const viaGz =
      !NO_GZ.test(name) && typeof DecompressionStream === 'function'
        ? fetch('/data/' + name + '.gz').then(r => {
            if (!r.ok || !r.body) throw new Error('no gz');
            return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
          })
        : Promise.reject(new Error('no gz'));
    cache[name] = viaGz.catch(() => fetchPlain(name)).catch(e => {
      delete cache[name]; // the next open tries again
      throw e;
    });
  }
  return cache[name];
}
