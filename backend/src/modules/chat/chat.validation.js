export function validateMessage(data) {

  validateContent(data);

  if (!data.workspace_id) {
    throw new Error("Workspace required");
  }

  if (!data.workspace_type) {
    throw new Error("Workspace type required");
  }

}

export function validateDirectMessage(data) {

  validateContent(data);

  if (!data.recipient_id) {
    throw new Error("Recipient required");
  }

}

function validateContent(data) {
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];
  if (typeof data.message === "string" && data.message.length > 2000) {
    throw new Error("Messages must be 2,000 characters or fewer");
  }
  if (!data.message?.trim() && attachments.length === 0) {
    throw new Error("Message or attachment required");
  }
  if (attachments.length > 2) throw new Error("You can attach up to 2 files");

  const allowedTypes = new Set([
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf", "text/plain", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  const totalSize = attachments.reduce((sum, attachment) => {
    if (!attachment || !allowedTypes.has(attachment.mimeType)) {
      throw new Error("That file type is not supported");
    }
    if (typeof attachment.filename !== "string" || !attachment.filename.trim() || attachment.filename.length > 180) {
      throw new Error("Attachment filename is invalid");
    }
    if (!Number.isInteger(attachment.size) || attachment.size < 0 || attachment.size > 1.5 * 1024 * 1024) {
      throw new Error("Attachments must be 1.5 MB or smaller");
    }
    const expectedPrefix = `data:${attachment.mimeType};base64,`;
    if (typeof attachment.url !== "string" || !attachment.url.startsWith(expectedPrefix)) {
      throw new Error("Attachment data is invalid");
    }
    const encodedData = attachment.url.slice(expectedPrefix.length);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encodedData) || encodedData.length > 2 * 1024 * 1024) {
      throw new Error("Attachment data is invalid or too large");
    }
    return sum + attachment.size;
  }, 0);
  if (totalSize > 3 * 1024 * 1024) throw new Error("Combined attachments must be 3 MB or smaller");
  data.attachments = attachments;
}
