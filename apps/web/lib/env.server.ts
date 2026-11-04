import "server-only";
import { parseServerEnv } from "./env-server-schema";

export const serverEnv = parseServerEnv(process.env);
