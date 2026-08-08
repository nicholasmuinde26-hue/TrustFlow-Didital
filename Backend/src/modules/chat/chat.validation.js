export function validateMessage(data) {

  if (!data.message?.trim()) {
    throw new Error("Message required");
  }

  if (!data.workspace_id) {
    throw new Error("Workspace required");
  }

  if (!data.workspace_type) {
    throw new Error("Workspace type required");
  }

}