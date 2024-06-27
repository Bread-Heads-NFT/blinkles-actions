/**
 * Solana Actions Example
 */

import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  MEMO_PROGRAM_ID,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import {
  clusterApiUrl,
  ComputeBudgetProgram,
  Connection,
  PublicKey as Web3JsPublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  fromWeb3JsPublicKey,
  toWeb3JsLegacyTransaction,
  toWeb3JsPublicKey,
  toWeb3JsTransaction,
} from "@metaplex-foundation/umi-web3js-adapters"
import { createNoopSigner, generateSigner, PublicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { create, mplCore } from "@metaplex-foundation/mpl-core";

export const GET = async (req: Request) => {
  const payload: ActionGetResponse = {
    title: "Mint your Blinkle",
    icon: new URL("/blinkles.png", new URL(req.url).origin).toString(),
    description: "Mint a Blinkle to participate in battles!",
    label: "Mint Blinkle",
  };

  return Response.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
};

// DO NOT FORGET TO INCLUDE THE `OPTIONS` HTTP METHOD
// THIS WILL ENSURE CORS WORKS FOR BLINKS
export const OPTIONS = GET;

export const POST = async (req: Request) => {
  try {
    const body: ActionPostRequest = await req.json();

    let account: PublicKey;
    try {
      account = fromWeb3JsPublicKey(new Web3JsPublicKey(body.account));
    } catch (err) {
      return new Response('Invalid "account" provided', {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }

    const umi = createUmi(process.env.SOLANA_RPC! || clusterApiUrl("devnet")).use(mplCore());

    const tx = create(umi, {
      asset: generateSigner(umi),
      payer: createNoopSigner(account),
      owner: account,
      name: "Test Blinkle",
      uri: "www.example.com",
    }).build(umi);

    let transaction = toWeb3JsLegacyTransaction(tx);

    // set the end user as the fee payer
    transaction.feePayer = toWeb3JsPublicKey(account);

    transaction.recentBlockhash = (await umi.rpc.getLatestBlockhash()).blockhash;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: "Post this memo on-chain",
      },
      // no additional signers are required for this transaction
      // signers: [],
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
