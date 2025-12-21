export type SecretString = {
  DANGEROUSLY_readValue: () => string;
  toString: () => string;
  toJSON: () => string;
};

const init = (name: string, value: unknown): SecretString | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const message = `SecretString.of(${name})`;
  const secretString: SecretString = {
    DANGEROUSLY_readValue: () => value,
    toString: () => message,
    [Symbol.for('nodejs.util.inspect.custom')]: () => message,
    toJSON: () => message,
  };
  return secretString;
};

const fromEnvVar = (name: string): SecretString | null => {
  const value = process.env[name];
  if (!value) {
    return null;
  }
  return init(name, value);
};

const assertEnvVar = (name: string): SecretString => {
  const value = fromEnvVar(name);
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
};

export const SecretString = {
  init,
  fromEnvVar,
  assertEnvVar,
};
