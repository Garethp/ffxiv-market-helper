import { useSyncExternalStore } from "react";
import type { ItemDataStatus } from "../services/itemDataCache";
import { itemService } from "../services/itemService";

const subscribe = (listener: () => void) =>
  itemService.subscribeToItemDataStatus(listener);
const getStatus = () => itemService.getItemDataStatus();

/** How far getting the item data ready has got, kept current. */
export const useItemDataStatus = (): ItemDataStatus =>
  useSyncExternalStore(subscribe, getStatus);
