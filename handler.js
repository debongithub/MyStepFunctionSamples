const AWS = require('aws-sdk');

exports.handler = async (event, context) => {
  const athena = new AWS.Athena({ apiVersion: '2017-05-18' });
  const sns = new AWS.SNS({ apiVersion: '2010-03-31' });

  // Query Athena
  const query = 'SELECT * FROM "default"."SourceTable" limit 10;';
  const params = {
    QueryString: query,
    ResultConfiguration: {
      OutputLocation: 's3://amazon-connect-18cab43f438e/'
    }
  };
  const queryExecution = await athena.startQueryExecution(params).promise();
  const queryExecutionId = queryExecution.QueryExecutionId;

  // Wait for the query to complete
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    const queryExecutionResult = await athena.getQueryExecution({ QueryExecutionId: queryExecutionId }).promise();
    status = queryExecutionResult.QueryExecution.Status.State;
    console.log("Status of the Query : " + status)
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
  }

  // Get the query results
  const resultParams = {
    QueryExecutionId: queryExecutionId
  };
  const result = await athena.getQueryResults(resultParams).promise();

  // Format the results
  const formattedResults = formatResults(result);
  console.log(formattedResults);

  // Publish the results to SNS
  const snsParams = {
    Message: JSON.stringify(formattedResults),
    TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic'
  };
  await sns.publish(snsParams).promise();
};

function formatResults(result) {
  // Format the query results in the desired format
  // For example, you could return an array of objects, where each object represents a row in the query results
  const rows = result.ResultSet.Rows;
  const headers = rows.shift().Data.map(header => header.VarCharValue);
  const formattedResults = rows.map(row => {
    const obj = {};
    row.Data.forEach((value, index) => {
      obj[headers[index]] = value.VarCharValue;
    });
    return obj;
  });
  return formattedResults;
}
