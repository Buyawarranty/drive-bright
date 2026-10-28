/** Only the latest ownership read may approve a notification. */
export const createPopupOwnershipRequests = () => {
  let generation = 0;
  return {
    begin: () => ++generation,
    invalidate: () => { generation += 1; },
    isCurrent: (request: number) => request === generation,
  };
};