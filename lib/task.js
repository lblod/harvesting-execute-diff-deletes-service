import * as mas from '@lblod/mu-auth-sudo';
import * as env from './env';
import * as rst from 'rdf-string-ttl';
import * as N3 from 'n3';
import { v4 as uuid } from 'uuid';
import { NAMESPACES as ns } from './env';
const { literal } = N3.DataFactory;

/**
 * Updates the state of the given task to the specified status, potentially
 * attaching an error to the task, or a resultcontainer with resulting files.
 *
 * @public
 * @async
 * @function
 * @param {NamedNode} task - The task in the triplestore to be modified.
 * @param {NamedNode} status - New status for the task.
 * @param {NamedNode} [error] - Potential error to attach to the task.
 * @param {Array(NamedNode)} [resultFiles] - Potential collection of files that
 * need to be attached via a result container.
 */
export async function updateTaskStatus(task, status, error, resultFiles) {
  const store = new N3.Store();

  if (resultFiles && resultFiles.length > 0) {
    const resultContainerUuidString = uuid();
    const resultContainerUuid = literal(resultContainerUuidString);
    const resultContainer = ns.asj`${resultContainerUuidString}`;
    store.addQuad(task, ns.task`resultsContainer`, resultContainer);
    store.addQuad(resultContainer, ns.rdf`type`, ns.nfo`DataContainer`);
    store.addQuad(
      resultContainer,
      ns.mu`uuid`,
      rst.termToString(resultContainerUuid)
    );
    for (const file of resultFiles) {
      store.addQuad(resultContainer, ns.task`hasFile`, file);
    }
  }

  if (error && status.value === env.TASK_FAILURE_STATUS) {
    store.addQuad(task, ns.task`hasError`, error);
  }

  const now = literal(new Date().toISOString(), env.xsd`DateTime`);
  store.addQuad(task, ns.adms`status`, rst.termToString(status));
  store.addQuad(task, ns.dct`modified`, rst.termToString(now));

  const writer = new N3.Writer(); //TODO test prefixes
  for (const triple of store) writer.addQuad(triple);
  const taskTriples = await new Promise((resolve, reject) => {
    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  return mas.updateSudo(`
    ${env.PREFIXES}
    DELETE {
      GRAPH ?g {
        ${rst.termToString(task)}
          adms:status ?oldStatus ;
          dct:modified ?oldModified .
      }
    }
    INSERT {
      GRAPH ?g {
        ${taskTriples}
      }
    }
    WHERE {
      GRAPH ?g {
        ${rst.termToString(task)}
          adms:status ?oldStatus ;
          dct:modified ?oldModified .
      }
    }
  `);
}
