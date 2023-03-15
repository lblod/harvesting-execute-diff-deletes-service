# harvesting-execute-diff-deletes-service

This service reacts to messages from the delta-notifier about tasks in the
harvester stack. This service should be configured in the jobs-controller to
work just after the
[harvesting-diff-service](https://github.com/lblod/harvesting-diff-service/).
It searches for a file containing the triples that are no longer found in the
currently ingested file compared to a previously ingested file (if it exists)
and deletes them from the triplestore. This makes the delta-producer create
correct deletes next to the inserts that come from importing.

## How it works

This is one of the services that can be configured to use in the harvesting
application. It listens to scheduled tasks for the
`http://lblod.data.gift/id/jobs/concept/TaskOperation/harvester-execute-diff-deletes-service`
operation and queries the triplestore to get the `inputContainer`. The files in
this container are files that where produced as the `resultsContainer` by the
`harvesting-diff-service`. It picks the correct file for deletes, retrieves
that file from local storage and executes its contents in the form of deletes
to the triplestore, in the graph that is being monitored by a delta-producer.
This leads to the creation of delta files that have proper deletes, next to the
inserts that originate from the
[import-with-sameas-service](https://github.com/lblod/import-with-sameas-service).

## Adding to a stack

To add the service to a mu-semtech stack (probably something like a
[harvester](https://github.com/lblod/app-lblod-harvester/)), add the following
snippet to the `docker-compose.yml` file as a service:

```yaml
harvesting-execute-diff-deletes:
  image: lblod/harvesting-execute-diff-deletes-service:1.0.0
  environment:
    TARGET_GRAPH: "http://mu.semte.ch/graphs/public"
  volumes:
    - ./data/files:/share
```

To make sure the delta-notifier sends the needed messages, add the following
snippet to the `rules.js` file:

```javascript
{
  match: {
    predicate: {
      type: 'uri',
      value: 'http://www.w3.org/ns/adms#status',
    },
    object: {
      type: 'uri',
      value: 'http://redpencil.data.gift/id/concept/JobStatus/scheduled',
    },
  },
  callback: {
    method: 'POST',
    url: 'http://harvesting-execute-diff-deletes/delta',
  },
},
```

As an example, the following snippet from the jobs-controllers `config.json`
shows how the jobs-controller can be configured to incorporate this service:

```json
{
  "currentOperation": "http://lblod.data.gift/id/jobs/concept/TaskOperation/diff",
  "nextOperation": "http://lblod.data.gift/id/jobs/concept/TaskOperation/execute-diff-deletes",
  "nextIndex": "5"
},
{
  "currentOperation": "http://lblod.data.gift/id/jobs/concept/TaskOperation/execute-diff-deletes",
  "nextOperation": "http://lblod.data.gift/id/jobs/concept/TaskOperation/publishHarvestedTriples",
  "nextIndex": "6"
},
```

## API

### POST `/delta`

Main entry point for this service. This is where delta messages arrive. Returns
a `200 OK` as soon as the request is being handled.

## Configuration

These are environment variables that can be used to configure this service.
Supply a value for them using the `environment` keyword in the
`docker-compose.yml` file.

### Environment variables

* `TARGET_GRAPH`: *(optional, default: "http://mu.semte.ch/graphs/public")*
  Represents the graph where the deletes need to be executed in. This is
  probably also where the inserts are done and where eventually the
  delta-producer will monitor for changes.
* `LOGLEVEL`: *(optional, default: "silent")* Possible values are `["error",
  "info", "silent"]`. On `silent`, no errors or informational messages are
  printed. On `error`, only error messages are printed to the console. On
  `info`, both error messages and informational messages such as data
  processing results are printed. The amount of information might be limited.
* `MAX_BATCH_SIZE`: *(optional, default: "100")* Deletes are executed in
  batches. This variable sets the maximum size of such batches. A batch becomes
  even smaller automatically when errors start occuring to a size of one triple
  per batch. If there is stil an error, then the whole task will fail.
* `WRITE_ERRORS`: *(optional, default: "false", boolean)* Indicates if errors
  need to be written to the triplestore.
* `ERROR_GRAPH`: *(optional, default: "http://lblod.data.gift/errors")* Graph
  in the triplestore in which to write errors.
* `ERROR_BASE`: *(optional, default: "http://data.lblod.info/errors/")* URI
  base for constructing the subject of new Error individuals.

