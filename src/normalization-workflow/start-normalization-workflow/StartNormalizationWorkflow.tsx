export const StartNormalizationWorkflowScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-2xl p-8">
        <h1 className="text-3xl font-bold mb-8">Normalization</h1>

        <form className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="input-files" className="font-medium">
              Input Files
            </label>
            <input
              id="input-files"
              type="file"
              multiple
              className="border rounded p-2"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="target-files" className="font-medium">
              Target Files
            </label>
            <input
              id="target-files"
              type="file"
              multiple
              className="border rounded p-2"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="prompt" className="font-medium">
              Prompt
            </label>
            <textarea
              id="prompt"
              rows={4}
              className="border rounded p-2 resize-y"
              placeholder="Enter your prompt here..."
            />
          </div>

          <button
            type="submit"
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Start Normalization
          </button>
        </form>
      </div>
    </div>
  );
};
