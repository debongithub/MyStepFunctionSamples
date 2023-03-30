const AWS = require('aws-sdk');
const fs = require('fs');
const athena = new AWS.Athena();

exports.handler = async (event) => {
  const queries = JSON.parse(fs.readFileSync('query.json', 'utf8'));
  const query = queries[event.input];

  const params = {
    QueryString: query,
    QueryExecutionContext: {
      Database: 'your_database',
    },
    ResultConfiguration: {
      OutputLocation: 's3://your-output-bucket/',
    },
  };

  const startQueryExecution = (params) =>
    new Promise((resolve, reject) => {
      athena.startQueryExecution(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

  const getQueryExecution = (params) =>
    new Promise((resolve, reject) => {
      athena.getQueryExecution(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

  try {
    const startResponse = await startQueryExecution(params);
    const executionId = startResponse.QueryExecutionId;
    let status = 'RUNNING';

    while (status === 'RUNNING' || status === 'QUEUED') {
      await new Promise((r) => setTimeout(r, 5000));
      const result = await getQueryExecution({ QueryExecutionId: executionId });
      status = result.QueryExecution.Status.State;
    }

    return {
      input: event.input,
      query_execution_id: executionId,
      status: status,
    };
  } catch (error) {
    return {
      input: event.input,
      error: error.message,
    };
  }
};
