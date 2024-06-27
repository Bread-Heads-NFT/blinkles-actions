/**
 * Solana Actions Example
 */

import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import {
  Authorized,
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  StakeProgram,
  Transaction,
  VoteProgram,
} from "@solana/web3.js";
import { DEFAULT_STAKE_AMOUNT, DEFAULT_VALIDATOR_VOTE_PUBKEY } from "./const";

export const GET = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const { validator } = validatedQueryParams(requestUrl);

    const baseHref = new URL(
      `/api/actions/stake?validator=${validator.toBase58()}`,
      requestUrl.origin,
    ).toString();

    const payload: ActionGetResponse = {
      title: "Actions Example - Staking SOL",
      icon: new URL("/solana_devs.jpg", requestUrl.origin).toString(),
      description: `Stake your SOL to the ${validator.toBase58()} validator to secure the Solana network`,
      label: "Stake your SOL", // this value will be ignored since `links.actions` exists
      links: {
        actions: [
          {
            label: "Stake 1 SOL", // button text
            href: `${baseHref}&amount=${"0.11"}`,
          },
          {
            label: "Stake 5 SOL", // button text
            href: `${baseHref}&amount=${"5"}`,
          },
          {
            label: "Stake 10 SOL", // button text
            href: `${baseHref}&amount=${"10"}`,
          },
          {
            label: "Stake SOL", // button text
            href: `${baseHref}&amount={amount}`, // this href will have a text input
            parameters: [
              {
                name: "amount", // parameter name in the `href` above
                label: "Enter the amount of SOL to stake", // placeholder of the text input
                required: true,
              },
            ],
          },
        ],
      },
    };

    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (err) {
    console.log(err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new Response(message, {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
};

// DO NOT FORGET TO INCLUDE THE `OPTIONS` HTTP METHOD
// THIS WILL ENSURE CORS WORKS FOR BLINKS
export const OPTIONS = GET;

export const POST = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const { amount, validator } = validatedQueryParams(requestUrl);

    const body: ActionPostRequest = await req.json();

    // validate the client provided input
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return new Response('Invalid "account" provided', {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }

    const connection = new Connection(
      process.env.SOLANA_RPC! || clusterApiUrl("devnet"),
    );

    const minStake = await connection.getStakeMinimumDelegation();
    if (amount < minStake.value) {
      console.log("minimum stake:", minStake);
      throw `The minimum stake amount is ${minStake.value}`;
    }

    const stakeKeypair = Keypair.generate();

    const transaction = new Transaction().add(
      StakeProgram.createAccount({
        stakePubkey: stakeKeypair.publicKey,
        authorized: new Authorized(account, account),
        fromPubkey: account,
        lamports: 1 * LAMPORTS_PER_SOL,
        // note: if you want to time lock the stake account for any time period, this is how
        // lockup: new Lockup(0, 0, account),
      }),
      StakeProgram.delegate({
        stakePubkey: stakeKeypair.publicKey,
        authorizedPubkey: account,
        votePubkey: validator,
      }),
    );

    // set the end user as the fee payer
    transaction.feePayer = account;

    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Stake ${amount} SOL to validator ${validator.toBase58()}`,
      },
      // note: creating a new stake account requires the account's keypair to sign
      signers: [stakeKeypair],
    });

    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (err) {
    console.log(err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new Response(message, {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
};

function validatedQueryParams(requestUrl: URL) {
  let validator: PublicKey = DEFAULT_VALIDATOR_VOTE_PUBKEY;
  let amount: number = DEFAULT_STAKE_AMOUNT;

  try {
    if (requestUrl.searchParams.get("validator")) {
      validator = new PublicKey(requestUrl.searchParams.get("validator")!);
    }
  } catch (err) {
    throw "Invalid input query parameter: validator";
  }

  try {
    if (requestUrl.searchParams.get("amount")) {
      amount = parseFloat(requestUrl.searchParams.get("amount")!);
    }
    if (amount <= 0) throw "amount is too small";
  } catch (err) {
    throw "Invalid input query parameter: amount";
  }

  return {
    amount,
    validator,
  };
}
