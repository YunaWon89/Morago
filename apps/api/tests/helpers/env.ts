// Settings for tests. They do not need a database: the tests only check
// pure functions and requests that are answered before the database is used.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "mysql://root:root@127.0.0.1:3307/morago";
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-123";
