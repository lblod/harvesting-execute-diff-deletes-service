import bodyParser from 'body-parser';
import { app } from 'mu';
import { v4 as uuid } from 'uuid';
import { BASES as b } from './env';
import { NAMESPACES as ns } from './env';
import * as tsk from './lib/task';
import * as del from './lib/deletes';
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

app.post('/delta', async function (req, res) {
  //We can already send a 200 back. The delta-notifier does not care about the
  //result, as long as the request is closed.
  res.status(200).send().end();

  try {
    //Don't trust the delta-notifier, filter as best as possible. We just need
    //the task that was created to get started.
    const actualTasks = req.body
      .map((changeset) => changeset.inserts)
      .filter((inserts) => inserts.length > 0)
      .flat()
      .filter(
        (insert) => insert.predicate.value === env.OPERATION_PREDICATE.value
      )
      .filter(
        (insert) => insert.object.value === env.EXECUTE_DELETES_OPERATION.value
      )
      .map((insert) => insert.subject);

    for (const task of actualTasks) {
      try {
        const taskNode = namedNode(task.value);
        await tsk.updateTaskStatus(taskNode, env.TASK_ONGOING_STATUS);
        const deletesFilePh = await tsk.getDeletesFileFromInputContainer(
          taskNode
        );
        await del.executeDeletesFile(deletesFilePh);
        await tsk.updateTaskStatus(taskNode, env.TASK_SUCCESS_STATUS);
      } catch (err) {
        const taskNode = namedNode(task.value);
        const message = `Something went wrong while processing the deletes for task ${task.value}`;
        logError(message, err);
        const storedErr = await saveTaskError(message, err);
        await tsk.updateTaskStatus(
          taskNode,
          env.TASK_FAILURE_STATUS,
          storedErr
        );
      }
    }
  } catch (err) {
    const message =
      'The task for executing the deletes for a diff could not even be started or finished due to an unexpected problem.';
    logError(message, err);
    await saveTaskError(message, err);
  }
});

///////////////////////////////////////////////////////////////////////////////
// Error handler
///////////////////////////////////////////////////////////////////////////////

function logError(message, err) {
  if (env.LOGLEVEL === 'error' || env.LOGLEVEL === 'info')
    console.error(`${message}\n${err}`);
}

/**
 * TODO
 */
async function saveTaskError(message, err) {
  const errorStore = errorToStore(err, message);
  await saveError(errorStore);
  return errorStore.getSubjects(ns.rdf`type`, ns.oslc`Error`)[0];
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
 * @param {String} [extraDetail] - Some more optional details about the error.
 * @returns {N3.Store} A new Store with the properties to represent the error.
 */
function errorToStore(errorObject, extraDetail) {
  const store = new N3.Store();
  const errorUuid = uuid();
  const error = b.error(errorUuid);
  const now = literal(new Date().toISOString(), ns.xsd`DateTime`);
  store.addQuad(error, ns.rdf`type`, ns.oslc`Error`);
  store.addQuad(error, ns.mu`uuid`, literal(errorUuid));
  store.addQuad(
    error,
    ns.dct`creator`,
    literal('harvesting-execute-diff-deletes-service')
  );
  store.addQuad(error, ns.oslc`message`, literal(errorObject.message));
  store.addQuad(error, ns.dct`created`, now);
  if (extraDetail)
    store.addQuad(error, ns.oslc`largePreview`, literal(extraDetail));
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
async function saveError(errorStore) {
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
      GRAPH ${rst.termToString(env.ERROR_GRAPH)} {
        ${errorTriples}
      }
    }
  `);
}
