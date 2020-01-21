# codegen-dotnet-hotchocolate
C# types for hotchocolate



# Use

## Create a configuration file, e.g. codegen.yml

```
overwrite: true
schema: "/Users/your/schemas/schema.graphql"
documents: null
generates:
  types.cs:
    plugins:
      - "@derekjwilliams/graphqlgen-dotnet-hotchocolate"
```
## Run

```yarn graphql-codegen```


