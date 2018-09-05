
window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || {READ_WRITE: "readwrite"};
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

// Stubs for IE/Edge
function initStubHistoryDb() {
    var lastIndex = -1,
        database = [];

    return {
        append: function(html) {
            database[++lastIndex] = html;
            return Promise.resolve(lastIndex);
        },

        load: function(startId, reverse, limit, f) {
            var step = reverse ? -1 : 1,
                loaded = 0,
                id;

            startId = startId || 0;

            for(id = startId + step; id >= 0 && id < database.length && loaded < limit; id += step) {
                var v = database[id]; 
                f(id, v);
                loaded += v.length;
            }

            return Promise.resolve(loaded);
        },
        
        remove: function() {
        }
    };
}

// Actual implementation for web browsers.
function initIndexedHistoryDb() {
    var sessionId = String(Math.floor(Math.random()*1000000));

    var database = new Promise(function(accept, reject) {
        var request = window.indexedDB.open('dreamland', 2);

        request.onupgradeneeded = function(e) { 
            var db = request.result;
            console.log('upgrade');

            if(e.oldVersion < 1) {
                db.createObjectStore('terminal', { autoIncrement: true, keyPath: null });
            }

            if(e.oldVersion < 2) {
                var store = db.createObjectStore('session', { autoIncrement: false, keyPath: null });
                store.add(sessionId, 'current');
            }
        };

        request.onerror = function(e) {
            console.log('error', e.target.error);
            reject(e.target.error);
        };

        request.onsuccess = function(e) {
            accept(request.result);
        };
    })
    .then(function(db) {
        return new Promise(function(accept) {
            var store = db.transaction(['session'], 'readwrite').objectStore('session');
            
            // last window/tab wins: overwrite any existing session
            var request = store.put(sessionId, 'current');

            request.onsuccess = function(e) {
                accept(db);
            };
        });
    })
    .catch(function(e) {
        console.log('indexedDb operation failed, falling back to stub implementation');
        historyDb = initStubHistoryDb();
    });

    function getDb() {
        return database.then(function(db) {
            // check if we're still the current session
            return new Promise(function(accept) {
                var store = db.transaction(['session'], 'readonly').objectStore('session');
                var request = store.get('current');

                request.onsuccess = function(e) {
                    if(e.target.result !== sessionId) {
                        alert('SessionId mismatch: ' + e.target.result + ' != ' + sessionId + '\nPlease close this tab.');
                        window.location = 'about:blank';
                        throw new Error('SessionId mismatch!');
                    }
                    accept(db);
                };
            });
        });
    }

    return {
        // Append a html chunk to the history.
        // Takes a string and returns a Promise of database id associated with the entry
        append: function(html) {
            return getDb().then(function(db) {
                return new Promise(function(accept) {
                    db.transaction(['terminal'], 'readwrite').objectStore('terminal')
                        .add(html)
                        .onsuccess = function(e) {
                            accept(e.target.result);
                        };
                });
            });
        },

        // Load 'limit' number of bytes, starting at startId (excluding startId), 
        // going up/down depending on 'reverse' parameter and call f(key, value) for each record.
        // Return a Promise which is resolved when everything is loaded.
        load: function(startId, reverse, limit, f) {
            return new Promise(function(accept) {
                getDb().then(function(db) {
                    var loaded = 0;
                    var range;
                    var ds = db.transaction(['terminal']).objectStore('terminal');

                    if(startId) {
                        if(reverse) {
                            range = IDBKeyRange.upperBound(startId, true);
                        } else {
                            range = IDBKeyRange.lowerBound(startId, true);
                        }
                    } else {
                        range = null;
                    }

                    ds.openCursor(range, reverse ? 'prev' : 'next').onsuccess = function(e) {
                        var next = e.target.result;

                        if(next) {
                            f(next.key, next.value);

                            loaded += next.value.length;

                            if(loaded < limit) {
                                next.continue();
                                return;
                            }
                        }

                        accept(loaded);
                    };
                });
            });
        },

        // Remove rows
        // TODO
        remove: function() {
        }
    };
}

var historyDb = window.indexedDB ? initIndexedHistoryDb() : initStubHistoryDb();
