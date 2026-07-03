const defaultHeaders = {
  'Content-Type': 'application/json',
};

async function parseJson(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }
  return response.json();
}

export async function createPipelineDefinition(payload: any) {
  const response = await fetch('/api/pipelines/templates', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}
