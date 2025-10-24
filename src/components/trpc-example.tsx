import { trpc } from "../lib/trpc-client";
import { useState } from "react";
import { useCurrentScreen } from "../screen/use-current-screen";
import { Button } from "../ui/button";

export const TrpcExample = () => {
  const [name, setName] = useState("World");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const { setCurrentScreen } = useCurrentScreen();

  // tRPC queries
  const helloQuery = trpc.example.hello.useQuery({ name });
  const userQuery = trpc.example.getUser.useQuery({ id: "1" });

  // tRPC mutation
  const createUserMutation = trpc.example.createUser.useMutation({
    onSuccess: (data) => {
      console.log("User created:", data);
      setNewUserName("");
      setNewUserEmail("");
    },
  });

  const handleCreateUser = () => {
    if (newUserName && newUserEmail) {
      createUserMutation.mutate({
        name: newUserName,
        email: newUserEmail,
      });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">tRPC Example</h2>
        <Button
          variant="outline"
          color="gray"
          onClick={() => setCurrentScreen({ type: "start-normalization" })}
        >
          Back to Normalizer
        </Button>
      </div>

      {/* Hello Query Example */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Hello Query</h3>
        <div className="mb-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 bg-gray-700 rounded text-white"
            placeholder="Enter name"
          />
        </div>
        {helloQuery.isLoading && <p>Loading...</p>}
        {helloQuery.error && (
          <p className="text-red-400">Error: {helloQuery.error.message}</p>
        )}
        {helloQuery.data && (
          <p className="text-green-400">{helloQuery.data.greeting}</p>
        )}
      </div>

      {/* Get User Query Example */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Get User Query</h3>
        {userQuery.isLoading && <p>Loading user...</p>}
        {userQuery.error && (
          <p className="text-red-400">Error: {userQuery.error.message}</p>
        )}
        {userQuery.data && (
          <div>
            <p>
              <strong>ID:</strong> {userQuery.data.id}
            </p>
            <p>
              <strong>Name:</strong> {userQuery.data.name}
            </p>
            <p>
              <strong>Email:</strong> {userQuery.data.email}
            </p>
          </div>
        )}
      </div>

      {/* Create User Mutation Example */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Create User Mutation</h3>
        <div className="space-y-2">
          <input
            type="text"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 rounded text-white"
            placeholder="User name"
          />
          <input
            type="email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 rounded text-white"
            placeholder="User email"
          />
          <button
            onClick={handleCreateUser}
            disabled={
              createUserMutation.isPending || !newUserName || !newUserEmail
            }
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {createUserMutation.isPending ? "Creating..." : "Create User"}
          </button>
        </div>
        {createUserMutation.error && (
          <p className="text-red-400 mt-2">
            Error: {createUserMutation.error.message}
          </p>
        )}
        {createUserMutation.data && (
          <div className="mt-2 p-2 bg-green-900 rounded">
            <p className="text-green-400">User created successfully!</p>
            <p>
              <strong>ID:</strong> {createUserMutation.data.id}
            </p>
            <p>
              <strong>Name:</strong> {createUserMutation.data.name}
            </p>
            <p>
              <strong>Email:</strong> {createUserMutation.data.email}
            </p>
            <p>
              <strong>Created:</strong> {createUserMutation.data.createdAt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
