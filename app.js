import bodyParser from 'body-parser';
import { app } from 'mu';
import { v4 as uuid } from 'uuid';
import { BASES as b } from './env';
import { NAMESPACES as ns } from './env';
import * as env from './env';
import * as mas from '@lblod/mu-auth-sudo';
import * as rst from 'rdf-string-ttl';
import * as N3 from 'n3';
const { namedNode, literal } = N3.DataFactory;

app.use(
  bodyParser.json({
    type: function (req) {
      return /^application\/json/.test(req.get('content-type'));
    },
    limit: '50mb',
    extended: true,
  })
);

app.get('/', function (req, res) {
  res.send('Hello from harvesting-execute-diff-deletes-service');
});

//TODO

///////////////////////////////////////////////////////////////////////////////
// Error handler
///////////////////////////////////////////////////////////////////////////////

// For some reason the 'next' parameter is unused and eslint notifies us, but
// when removed, Express does not use this middleware anymore.
/* eslint-disable no-unused-vars */
app.use(async (err, req, res, next) => {
  await logError(err);
});
/* eslint-enable no-unused-vars */

async function logError(err) {
  if (env.LOGLEVEL === 'error' || env.LOGLEVEL === 'info') console.error(err);
  if (env.WRITE_ERRORS === true) {
    const errorStore = errorToStore(err);
    await writeError(errorStore);
  }
}

///////////////////////////////////////////////////////////////////////////////
// Helpers
///////////////////////////////////////////////////////////////////////////////

/*
 * Produces an RDF store with the data to encode an error in the OSLC
 * namespace.
 *
 * @function
 * @param {Error} errorObject - Instance of the standard JavaScript Error class
 * or similar object that has a `message` property.
 * @returns {N3.Store} A new Store with the properties to represent the error.
 */
function errorToStore(errorObject) {
  const store = new N3.Store();
  const errorUuid = uuid();
  const error = b.error(errorUuid);
  store.addQuad(error, ns.rdf`type`, ns.oslc`Error`);
  store.addQuad(error, ns.mu`uuid`, literal(errorUuid));
  store.addQuad(
    error,
    ns.dct`creator`,
    literal('harvesting-execute-diff-deletes-service')
  );
  store.addQuad(error, ns.oslc`message`, literal(errorObject.message));
  return store;
}

/*
 * Receives a store with only the triples related to error messages and stores
 * them in the triplestore.
 *
 * @async
 * @function
 * @param {N3.Store} errorStore - Store with only error triples. (All of the
 * contents are stored.)
 * @returns {undefined} Nothing
 */
async function writeError(errorStore) {
  const writer = new N3.Writer();
  errorStore.forEach((q) => writer.addQuad(q));
  const errorTriples = await new Promise((resolve, reject) => {
    writer.end((err, res) => {
      if (err) reject(err);
      resolve(res);
    });
  });
  await mas.updateSudo(`
    INSERT DATA {
      GRAPH ${rst.termToString(namedNode(env.ERROR_GRAPH))} {
        ${errorTriples}
      }
    }
  `);
}
