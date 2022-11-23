export function getSecondsELapsedTillNow(timeStamp: number) {
    const millis = Date.now() - timeStamp;

    return millis / 1000; // seconds
}
