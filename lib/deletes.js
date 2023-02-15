import * as N3 from 'n3';
import * as mas from '@lblod/mu-auth-sudo';
import * as fsp from 'fs/promises';
import * as env from '../env';
import * as rst from 'rdf-string-ttl';

/**
 * Starts from a physical file to parse data from and to remove those triples
 * from the triplestore.
 *
 * @public
 * @async
 * @function
 * @param {NamedNode} deletesFilePh - RDF term representing the URI of the
 * physical file containing the deletes from the diff service.
 * @returns {undefined} Nothing. (Might return the response object of a REST
 * call to the triplestore to remove the data.)
 */
export async function executeDeletesFile(deletesFilePh) {
  const filepath = deletesFilePh.value.replace('share://', '/share/');
  const content = await fsp.readFile(filepath, 'utf-8');
  const parser = new N3.Parser();
  const toRemoveStore = await new Promise((resolve, reject) => {
    const store = new N3.Store();
    parser.parse(content, (err, quad) => {
      if (err) reject(err);
      else if (quad) store.addQuad(quad);
      else resolve(store);
    });
  });
  return executeDeletesStore(toRemoveStore);
}

/**
 * Deletes an N3 Store from the triplestore, making sure to use a workaround
 * for deleting typed `xsd:string` in the data.
 *
 * @public
 * @async
 * @function
 * @param {N3.Store} store - Store containing the data that needs to be
 * removed.
 * @returns {undefined} Nothing. (Might return the response object of a REST
 */
export async function executeDeletesStore(store) {
  if (store.size <= 0) return;
  const writer = new N3.Writer();
  for (const triple of store) writer.addQuad(triple);
  const toRemoveString = await new Promise((resolve, reject) => {
    writer.end((err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
  const toRemoveStrings = [];
  for (const triple of store) toRemoveStrings.push(formatTriple(triple));
  return mas.updateSudo(`
    DELETE DATA {
      GRAPH ${rst.termToString(env.TARGET_GRAPH)} {
        ${toRemoveString}
        ${toRemoveStrings.join('\n')}
      }
    }
  `);
}

/**
 * Formats a quad in a Turtle/Notation3-like syntax for use in QPARQL queries.
 * The graph in the quad is ignored.
 *
 * **Please don't use this unless absolutely necessary.**
 * This should produce the same results as a TTL writer, but literals with
 * datatype `xsd:string` in the term in the store, also explicitly have the
 * `^^xsd:string` in the TTL. Regular writers see this as redundant information
 * and don't print the `^^xsd:string`, however, due to the weird(?) behaviour
 * of Virtuoso, we need the type if we want to remove a typed literal from the
 * triplestore, including for strings. This is also because the delta-consumer
 * **always** adds the type to a literal, even for strings where that would be
 * redundant.
 *
 * @function
 * @param {Quad} quad - Quad to be formatted into a Turtle/Notation3 compatible
 * string.
 * @returns {String} String representation of the quad.
 */
function formatTriple(quad) {
  return `${rst.termToString(quad.subject)} ${rst.termToString(
    quad.predicate
  )} ${formatTerm(quad.object)} .`;
}

/**
 * Formats an RDF term into a Turtle/Notation3 compatible string.
 *
 * **NOTE:** special about this function is that it explicitely adds the
 * `^^xsd:string` datatype annotation if it is present in the term to be
 * compatible with Virtuoso in DELETE queries. Prefer regular RDF writer for
 * more comprehensive writing of triples and terms.
 *
 * @function
 * @param {NamedNode} term -
 * @returns {String}
 */
function formatTerm(term) {
  if (
    term.datatype?.value === 'http://www.w3.org/2001/XMLSchema#string' ||
    term.datatype?.value ===
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
  )
    return `${rst.termToString(term)}^^${rst.termToString(term.datatype)}`;
  else return rst.termToString(term);
}
