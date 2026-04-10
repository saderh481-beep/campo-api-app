import { redis } from "@/lib/redis";

export const CHANNELS = {
  BENEFICIARIOS_UPDATED: "beneficiarios:updated",
  BITACORA_UPDATED: "bitacora:updated",
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

export async function publishUpdate(channel: ChannelName, tecnicoId: string, data: object) {
  const message = JSON.stringify({
    tecnicoId,
    timestamp: new Date().toISOString(),
    ...data,
  });

  try {
    await redis.publish(channel, message);
    console.log(`[PubSub] Published to ${channel}:`, message);
  } catch (error) {
    console.error(`[PubSub] Error publishing to ${channel}:`, error);
  }
}
