import { Response } from "express";
import { supabase } from "./supabaseAuth";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  // Upload a file to Supabase Storage
  async uploadObject(bucket: string, path: string, fileBuffer: Buffer, contentType: string): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    return data?.path || path;
  }

  // Download a file from Supabase Storage
  async downloadObject(bucket: string, path: string, res: Response) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Length": buffer.length.toString(),
    });
    res.send(buffer);
  }

  // Get public URL for a file
  getPublicUrl(bucket: string, path: string): string {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  // Remove object
  async removeObject(bucket: string, path: string) {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  }
}


// parseObjectPath and signObjectURL are not needed for Supabase Storage
