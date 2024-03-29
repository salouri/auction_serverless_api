'use strict';
import createError from 'http-errors';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import ddbDocClient from '../libs/ddbDocClient.js';
import commonMiddleware from '../libs/commonMiddleware.js';
import validatorMiddleware from '@middy/validator';
import getAuctionById from '../libs/getAuctionById.js';
import placeBidSchema from '../libs/schemas/placeBidSchema.js';
import responseSchema from '../libs/schemas/httpLambdaResponseSchema.js';

const placeBid = async (event, context) => {
  let updatedAuction;
  const bidder = event.requestContext.authorizer.email;
  const { id } = event.pathParameters;
  const { amount } = event.body;

  const auction = await getAuctionById(id);

  if (bidder === auction.seller) {
    throw new createError.Forbidden(`You cannot bid on your own auction!`);
  }

  if (auction.status !== 'OPEN') {
    throw new createError.Forbidden(
      `Auction was closed on ${auction.endingAt.slice(0, 19)}`
    );
  }
  if (amount <= auction.highestBid.amount) {
    throw new createError.Forbidden(
      `Your bid must be higher than ${auction.highestBid.amount}!`
    );
  }

  if (bidder === auction.highestBid.bidder) {
    throw new createError.Forbidden(`You are already the highest bidder!`);
  }

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression:
      'set highestBid.amount = :amount , highestBid.bidder = :bidder',
    ConditionExpression: 'highestBid.amount < :amount AND #status = :status',
    ExpressionAttributeValues: {
      ':amount': amount,
      ':status': 'OPEN',
      ':bidder': bidder,
    },
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ReturnValues: 'ALL_NEW',
  };

  try {
    const data = await ddbDocClient.send(new UpdateCommand(params));
    console.log(`data: ${JSON.stringify(data, null, 2)}`);
    updatedAuction = data?.Attributes;
  } catch (error) {
    console.log(error);
    throw new createError.InternalServerError('Ops! something went wrong');
  }
  if (!updatedAuction) {
    throw new createError.NotFound(`Auction with ID "${id}" not found!`);
  }
  return {
    statusCode: 203,
    body: JSON.stringify(updatedAuction),
  };
};

export const handler = commonMiddleware(placeBid).use(
  validatorMiddleware({
    responseSchema,
    eventSchema: placeBidSchema,
    ajvOptions: {
      useDefaults: false,
      strict: false,
    },
  })
);
