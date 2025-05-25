import * as example from "./tools/example";

type Request = {
  method: string;
  params?: any;
};

process.stdin.on("data", async (chunk) => {
  const { method, params }: Request = JSON.parse(chunk.toString());
  let result = null;

  try {
    if (method === "tools/getTime") {
      result = await example.getTime();
    } else {
      throw new Error(`Unknown method: ${method}`);
    }

    process.stdout.write(JSON.stringify({ result }) + "\n");
  } catch (err: any) {
    process.stderr.write(JSON.stringify({ error: err.message }) + "\n");
  }
});
