import { SQSClient } from '@aws-sdk/client-sqs';
// Set the AWS Region.
const REGION = process.env.AWS_REGION; //e.g. "us-east-1"
// Create SQS service object.
const sqsClient = new SQSClient({ region: REGION });
export { sqsClient };
