import * as mas from '@lblod/mu-auth-sudo';
import * as env from '../env';
import * as rst from 'rdf-string-ttl';
import * as sjp from 'sparqljson-parse';
import * as N3 from 'n3';
//import { v4 as uuid } from 'uuid';
import { NAMESPACES as ns } from '../env';
const { literal } = N3.DataFactory;

/**
 * Updates the state of the given task to the specified status, potentially
 * attaching an error to the task, or a resultcontainer with resulting files.
 * **IMPORTANT:** this function always puts the inputcontainer as the
 * resultcontainer because this service should not produce new files or remove
 * any files that might be needed for the next task in the Job.
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
export async function updateTaskStatus(task, status, error /*, resultFiles*/) {
  const store = new N3.Store();

  //if (resultFiles && resultFiles.length > 0) {
  //  const resultContainerUuidString = uuid();
  //  const resultContainerUuid = literal(resultContainerUuidString);
  //  const resultContainer = ns.asj`${resultContainerUuidString}`;
  //  store.addQuad(task, ns.task`resultsContainer`, resultContainer);
  //  store.addQuad(resultContainer, ns.rdf`type`, ns.nfo`DataContainer`);
  //  store.addQuad(
  //    resultContainer,
  //    ns.mu`uuid`,
  //    rst.termToString(resultContainerUuid)
  //  );
  //  for (const file of resultFiles) {
  //    store.addQuad(resultContainer, ns.task`hasFile`, file);
  //  }
  //}

  if (error && status.value === env.TASK_FAILURE_STATUS.value)
    store.addQuad(task, ns.task`hasError`, error);

  const now = literal(new Date().toISOString(), ns.xsd`dateTime`);
  store.addQuad(task, ns.adms`status`, status);
  store.addQuad(task, ns.dct`modified`, now);

  const writer = new N3.Writer(); //TODO test prefixes
  for (const triple of store) writer.addQuad(triple);
  const taskTriples = await new Promise((resolve, reject) => {
    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  return mas.updateSudo(`
    ${env.SPARQL_PREFIXES}
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
        ${rst.termToString(task)}
          task:resultsContainer ?container .
      }
    }
    WHERE {
      GRAPH ?g {
        ${rst.termToString(task)}
          adms:status ?oldStatus ;
          dct:modified ?oldModified ;
          task:inputContainer ?container .
      }
    }
  `);
}

/**
 * Queries the triple store for the information about the file containing the
 * deleted triples from the diff service.
 *
 * @public
 * @async
 * @function
 * @param {NamedNode} task - RDF term representing the task.
 * @returns {NamedNode} The RDF term prepresenting the physical file containing
 * the removed triples.
 */
export async function getDeletesFileFromInputContainer(task) {
  //This is still based on the filename "to-remove-triples.ttl"! This should
  //change in the future, but there is no other way to correctly address that
  //file only yet, besides via its filename.
  const response = await mas.querySudo(`
    ${env.SPARQL_PREFIXES}
    SELECT DISTINCT ?physicalFile WHERE {
      ${rst.termToString(task)}
        a task:Task ;
        task:inputContainer ?inputContainer .

      ?inputContainer
        a nfo:DataContainer ;
        task:hasFile ?logicalFile .

      ?logicalFile
        a nfo:FileDataObject ;
        nfo:fileName "to-remove-triples.ttl" .

      ?physicalFile
        a nfo:FileDataObject ;
        nie:dataSource ?logicalFile .
    }
    LIMIT 1
  `);
  const sparqlJsonParser = new sjp.SparqlJsonParser();
  const parsedResults = sparqlJsonParser.parseJsonResults(response);
  return parsedResults[0]?.physicalFile;
}
