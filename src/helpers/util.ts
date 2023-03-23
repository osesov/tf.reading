
export function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export async function delay(sec: number)
{
    return new Promise( resolve => setTimeout(resolve, sec * 1000));
}
