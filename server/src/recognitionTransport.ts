// Shared private transport. Only trusted service responses can grade camera answers.
export async function recognitionRequest(path: string, options: RequestInit = {}) {
 const token=process.env.RECOGNITION_INTERNAL_TOKEN;
 if(!token) throw new Error('Recognition is not configured.');
 const response=await fetch(`${process.env.RECOGNITION_URL ?? 'http://127.0.0.1:8001'}${path}`,{...options,headers:{...options.headers,'X-Recognition-Key':token},signal:AbortSignal.timeout(12000),redirect:'error'});
 if(!response.ok) throw new Error('Recognition is unavailable. Start the recognition service and try again.');
 return response.status===204 ? null : response.json();
}
export async function recognitionCapabilities(): Promise<{labels:string[];model:string;threshold:number}> {
 const value=await recognitionRequest('/capabilities');
 if(!Array.isArray(value?.labels) || !value.labels.every((label:unknown)=>typeof label==='string') || typeof value.model!=='string' || value.threshold!==.8) throw new Error('Recognition capabilities are unavailable.');
 return value;
}
