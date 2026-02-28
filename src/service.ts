import { AbstractFileProviderService, MedusaError } from "@medusajs/framework/utils"
import { FileTypes, Logger, ProviderDeleteFileDTO, ProviderFileResultDTO, ProviderGetFileDTO, ProviderUploadFileDTO } from "@medusajs/framework/types"
import { Readable } from "stream"
import { Storage } from "@google-cloud/storage"

type InjectedDependencies = {
  logger: Logger
}

type GoogleCloudServiceAccountKey = {
    type: string
    project_id: string
    private_key_id: string
    private_key: string
    client_email: string
    client_id: string
    auth_uri: string
    token_uri: string
    auth_provider_x509_cert_url: string
    client_x509_cert_url: string
}

type Options = {
    bucketName: string
    serviceAccountKey: GoogleCloudServiceAccountKey
    preSignedUrlExpiry?: number // In minutes
    debug?: boolean
    prefix?: string // Optional prefix for all file paths (e.g. "uploads/" or "medusa/files/")
    baseUrl?: string // Optional base URL for public files (e.g. "https://cdn.example.com" or "https://storage.googleapis.com/my-bucket")
}

/**
 * Google Cloud Storage file provider service
 */
class GoogleCloudFileProviderService extends AbstractFileProviderService {
  protected logger_: Logger
  protected options_: Options
  protected storage_: Storage
  static identifier = "google-cloud"

  /**
   * Google Cloud Storage file provider service
   * @param param0 - The logger instance
   * @param options - The options for the service
   */
  constructor (
    { logger }: InjectedDependencies,
    options: Options
  ) {
    super()

    this.logger_ = logger
    this.options_ = options

    // Normalize prefix: ensure it ends with "/" if provided, or default to ""
    if (this.options_.prefix) {
      this.options_.prefix = this.options_.prefix.replace(/\/+$/, "") + "/"
    }

    // Normalize baseUrl: strip trailing slash if present
    if (this.options_.baseUrl) {
      this.options_.baseUrl = this.options_.baseUrl.replace(/\/+$/, "")
    }

    // Initialize Google Cloud Storage client
    this.storage_ = new Storage({ credentials: this.options_.serviceAccountKey })
  }

  /**
   * Prepends the configured prefix to a filename.
   * @param filename - The original filename
   * @returns The prefixed file path
   */
  private withPrefix(filename: string): string {
    return this.options_.prefix
      ? `${this.options_.prefix}${filename}`
      : filename
  }

  /**
   * Validates the options for the Google Cloud Storage provider
   * @param options - The options to validate
   */
  static validateOptions(options: Record<string, unknown>) {
    if (!options.bucketName) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Bucket name is required in the provider's options."
      )
    }

    if (!options.serviceAccountKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Service account key is required in the provider's options."
      )
    }
  }

  /**
   * Deletes files from Google Cloud Storage
   * @param files - The files to delete
   */
  async delete(files: FileTypes.ProviderDeleteFileDTO | FileTypes.ProviderDeleteFileDTO[]): Promise<void> {
    const bucket = this.storage_.bucket(this.options_.bucketName);

    if (this.options_.debug) {
      this.logger_.log(`Deleting files from GCS: ${JSON.stringify(files)}`);
    }

    const fileArray = Array.isArray(files) ? files : [files];

    if (this.options_.debug) {
      this.logger_.log(
        `Deleting ${fileArray.length} file(s) from GCS: ` +
        fileArray.map(f => f.fileKey).join(", ")
      );
    }

    try {
      await Promise.all(
        fileArray.map(({ fileKey }) =>
          bucket
            .file(fileKey)
            .delete({ ignoreNotFound: true })
            .then(() => {
              if (this.options_.debug) {
                this.logger_.log(`Deleted GCS object: ${fileKey}`);
              }
            })
        )
      );
    } catch (err) {
      this.logger_.error("Failed to delete files from GCS", err);
      throw err;
    }
  }

  /**
   * Gets a file as a buffer from Google Cloud Storage
   * @param file - The file to get
   * @returns The file as a buffer
   */
  async getAsBuffer(file: ProviderDeleteFileDTO): Promise<Buffer> {
    try {
      if (this.options_.debug) {
        this.logger_.log("Getting file as buffer from Google Cloud Storage: " + file.fileKey)
      }
      const [buffer] = await this.storage_.bucket(this.options_.bucketName).file(file.fileKey).download()
      return buffer
    } catch (error) {
      this.logger_.error("Failed to get file as buffer from Google Cloud Storage", error)
      throw error
    }
  }

  /**
   * Gets a file as a stream from Google Cloud Storage
   * @param file - The file to get
   * @returns The file as a stream
   */
  async getAsStream(file: ProviderDeleteFileDTO): Promise<Readable> {
    try {
      if (this.options_.debug) {
        this.logger_.log("Getting file as stream from Google Cloud Storage: " + file.fileKey)
      }
      const stream = this.storage_.bucket(this.options_.bucketName).file(file.fileKey).createReadStream()
      return stream
    } catch (error) {
      this.logger_.error("Failed to get file as stream from Google Cloud Storage", error)
      throw error
    }
  }

  /**
   * Gets a presigned download URL for a file from Google Cloud Storage
   * @param fileData - The file to get the presigned URL for
   * @returns The presigned URL
   */
  async getPresignedDownloadUrl(
    fileData: ProviderGetFileDTO
  ): Promise<string> {
    try {
      if (this.options_.debug) {
        this.logger_.log("Getting presigned download URL from Google Cloud Storage: " + fileData.fileKey)
      }
      const [url] = await this.storage_.bucket(this.options_.bucketName).file(fileData.fileKey).getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * (this.options_.preSignedUrlExpiry || 15), // Use configured expiry or default to 15 minutes
      })
      if (this.options_.debug) {
        this.logger_.log(`Got presigned download URL from Google Cloud Storage: ${fileData.fileKey} - URL: ${url}`)
      }
      return url
    } catch (error) {
      this.logger_.error("Failed to get presigned download URL from Google Cloud Storage", error)
      throw error
    }
  }

  /**
   * Gets a presigned upload URL for a file from Google Cloud Storage
   * @param fileData - The file to get the presigned URL for
   * @returns The presigned URL and file key
   */
  async getPresignedUploadUrl(fileData: FileTypes.ProviderGetFileDTO): Promise<string> {
    try {
      if (this.options_.debug) {
        this.logger_.log("Getting presigned upload URL from Google Cloud Storage: " + fileData.fileKey)
      }
      const [url] = await this.storage_.bucket(this.options_.bucketName).file(fileData.fileKey).getSignedUrl({
        action: "write",
        expires: Date.now() + 1000 * 60 * (this.options_.preSignedUrlExpiry || 15), // Use configured expiry or default to 15 minutes
      })
      if (this.options_.debug) {
        this.logger_.log(`Got presigned upload URL from Google Cloud Storage: ${fileData.fileKey} - URL: ${url}`)
      }
      return url
    } catch (error) {
      this.logger_.error("Failed to get presigned upload URL from Google Cloud Storage", error)
      throw error
    }
  }

  /**
   * Uploads a file to Google Cloud Storage
   * @param file - The file to upload
   * @returns The uploaded file's metadata
   */
  async upload(
    file: ProviderUploadFileDTO
  ): Promise<ProviderFileResultDTO> {
    const bucket = this.storage_.bucket(this.options_.bucketName);
    const fileKey = this.withPrefix(file.filename);
    const gcsFile = bucket.file(fileKey);

    try {
      if (this.options_.debug) {
        this.logger_.log(`Uploading file to GCS: ${fileKey}`);
      }

      // 1. Decode base64 payload (strip data URI prefix if present)
      const base64Payload = file.content.includes("base64,")
        ? file.content.split("base64,")[1]
        : file.content;
      const content = Buffer.from(base64Payload, "base64");

      // 2. Save buffer directly to GCS with correct contentType
      await gcsFile.save(content, {
        resumable: false,
        contentType: file.mimeType,
      });

      let url: string;

      // 2a. Public file → use baseUrl (CDN) if configured, otherwise default GCS public URL.
      //     With uniform bucket-level access, public readability is controlled by the
      //     bucket's IAM policy — we must NOT call makePublic() on individual objects.
      if (file.access === "public") {
        url = this.options_.baseUrl
          ? `${this.options_.baseUrl}/${fileKey}`
          : gcsFile.publicUrl();

      // 2b. Private file → issue a signed (presigned) URL
      } else {
        url = await this.getPresignedDownloadUrl({ fileKey });
      }

      if (this.options_.debug) {
        this.logger_.log(`Uploaded ${fileKey} → URL: ${url}`);
      }

      return { url, key: fileKey };

    } catch (err) {
      this.logger_.error("Failed to upload to GCS", err);
      throw err;
    }
  }
}

export default GoogleCloudFileProviderService
