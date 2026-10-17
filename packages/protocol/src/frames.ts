import { z } from 'zod';

/**
 * Agent <-> relay WebSocket frames. All frames are single JSON objects sent as
 * WebSocket text messages. Unparseable frames and unknown `type` values are
 * silently ignored by both sides.
 */

export const RequestFrameSchema = z.object({
  type: z.literal('request'),
  jobId: z.string().min(1),
  method: z.string().optional(),
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  bodyBase64: z.string().optional(),
  timeoutMs: z.number().optional(),
  insecureTLS: z.boolean().optional(),
});

export const ResponseFrameSchema = z.object({
  type: z.literal('response'),
  jobId: z.string().min(1),
  status: z.number(),
  headers: z.record(z.string()),
  bodyBase64: z.string(),
  seq: z.number(),
});

export const ErrorFrameSchema = z.object({
  type: z.literal('error'),
  jobId: z.string().min(1),
  message: z.string(),
  seq: z.number(),
});

export const AckFrameSchema = z.object({
  type: z.literal('ack'),
  upto: z.number(),
});

export const PingFrameSchema = z.object({ type: z.literal('ping') });
export const PongFrameSchema = z.object({ type: z.literal('pong') });

/** Frames the relay sends to the agent. */
export const RelayToAgentFrameSchema = z.discriminatedUnion('type', [
  RequestFrameSchema,
  AckFrameSchema,
  PingFrameSchema,
]);

/** Frames the agent sends to the relay. */
export const AgentToRelayFrameSchema = z.discriminatedUnion('type', [
  ResponseFrameSchema,
  ErrorFrameSchema,
  PongFrameSchema,
]);

export type RequestFrame = z.infer<typeof RequestFrameSchema>;
export type ResponseFrame = z.infer<typeof ResponseFrameSchema>;
export type ErrorFrame = z.infer<typeof ErrorFrameSchema>;
export type AckFrame = z.infer<typeof AckFrameSchema>;
export type PingFrame = z.infer<typeof PingFrameSchema>;
export type PongFrame = z.infer<typeof PongFrameSchema>;
export type RelayToAgentFrame = z.infer<typeof RelayToAgentFrameSchema>;
export type AgentToRelayFrame = z.infer<typeof AgentToRelayFrameSchema>;
