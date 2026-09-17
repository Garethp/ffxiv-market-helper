/** Waits for a change to be made, calls `then` if it succeeded, and passes its result on either way. */
export const afterSuccess = async <Result extends { ok: boolean }>(
  change: Promise<Result>,
  then: () => void,
): Promise<Result> => {
  const result = await change;
  if (result.ok) then();
  return result;
};
