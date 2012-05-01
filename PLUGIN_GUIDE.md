
# Asset Descriptors

Asset descriptors are object hashes that define a given asset. Here are the
keys your asset must include:

  * `id`: module id
  * `path`: path to asset
  * `mtime`: last time the asset was modified, or 0

The asset must also provide a body as some point. You can either provide the
body as a simple property or you can provide a readable stream and a size:

  * `body`: a String that contains the body of the asset
  * `bodyStream` & `size`: a ReadableStream for the asset and the total size.
    Typically you would only do this if you are returning a large asset or just
    doing a simple file copy.

