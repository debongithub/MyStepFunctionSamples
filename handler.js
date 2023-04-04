// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

// Create an Athena and SNS object
const athena = new AWS.Athena({ apiVersion: '2017-05-18' });
const sns = new AWS.SNS({ apiVersion: '2010-03-31' });

// Convert query results to CSV
function convertToCSV(rows) {
  return rows.map(row => row.Data.map(cell => cell.VarCharValue).join(',')).join('\n');
}

// Lambda handler function
exports.handler = async (event) => {
  const namedQuery = event.namedQuery; // Named query from event object
  const database = process.env.DATABASE; // Database name from environment variable
  const params = {
    QueryExecutionContext: {
      Database: database // Replace with your database
    },
    ResultConfiguration: {
      OutputLocation: 's3://your-output-bucket/results/' // Replace with your output bucket
    },
    QueryString: '',
    QueryName: namedQuery
  };

  try {
    // Get the named query details
    const getNamedQueryResponse = await athena.getNamedQuery({ NamedQueryId: namedQuery }).promise();

    // Set the query string from the named query
    params.QueryString = getNamedQueryResponse.NamedQuery.QueryString;

    // Execute the query
    const startQueryExecutionResponse = await athena.startQueryExecution(params).promise();
    const queryExecutionId = startQueryExecutionResponse.QueryExecutionId;

    // Wait for query execution to finish
    let queryExecutionStatus;
    do {
      const getQueryExecutionResponse = await athena.getQueryExecution({ QueryExecutionId: queryExecutionId }).promise();
      queryExecutionStatus = getQueryExecutionResponse.QueryExecution.Status.State;
      if (queryExecutionStatus === 'FAILED' || queryExecutionStatus === 'CANCELLED') {
        throw new Error(`Query execution failed: ${queryExecutionStatus}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } while (queryExecutionStatus === 'RUNNING');

    // Fetch query results
    const getQueryResultsResponse = await athena.getQueryResults({ QueryExecutionId: queryExecutionId }).promise();
    const queryResults = getQueryResultsResponse.ResultSet.Rows;

    // Convert query results to CSV
    const csvResults = convertToCSV(queryResults);

    // Send email using SNS
    const snsParams = {
      Message: `Query results:\n\n${csvResults}`,
      Subject: 'Athena Query Results',
      TopicArn: 'arn:aws:sns:REGION:ACCOUNT_ID:TOPIC_NAME' // Replace with your SNS topic ARN
    };
    await sns.publish(snsParams).promise();

    return {
      statusCode: 200,
      body: 'Email sent successfully'
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: `Error: ${error.message}`
    };
  }
};
