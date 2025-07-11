# coc-groovy

An [extension for coc.nvim](https://github.com/neoclide/coc.nvim/wiki/Using-coc-extensions) to enable
[Groovy language server](https://github.com/prominic/groovy-language-server) support.

## Features

- Maven and Gradle project support
- Code Completion
- Find References
- Go to Definition
- Highlights
- Refactor Rename
- Signature Hover

## Quick Start

1. Download and install a recent Java Development Kit (latest Java 8 is the minimum requirement).
2. Install this extension by running this command in Vim:

   ```sh
   :CocInstall coc-groovy
   ```

3. This extension is activated when you first open a Groovy file.

## Dependencies

### Maven Projects

Maven project support requires having the [Maven Wrapper][0] installed in your
project or having [Maven][1] installed on your environment path.

- [Maven Wrapper][0]
- [Installing Maven][1]

## Available commands

The following coc.nvim commands are available:

- `groovy.project.config.update` : This is available when the editor is focused on a Groovy file. It forces project configuration/classpath updates (eg. dependency changes) according to the project build descriptor.

## Supported settings

The following settings are supported:

- `groovy.enable` : Enable the coc-groovy extension, default: `true`
- `groovy.java.home` : The absolute path to the JDK 8+ home directory. This is used to launch the Groovy language server. Requires a coc server restart.
- `groovy.ls.vmargs` : Extra Java VM arguments used to launch the Groovy language server. Requires a coc server restart.
- `groovy.ls.home` : The absolute path to the Groovy language server. This would be used instead of the bundled server when specified.
- `groovy.project.referencedLibraries` : Configure additional paths (jar file or directory) for referencing libraries in a Groovy project. Note, Maven and Gradle projects will have their classpath automatically added.
  - Example: `["/path/to/lib.jar", "/path/to/lib/*"]`
- `groovy.trace.server` : Traces the communication between the coc-groovy extension and the Groovy language server.
- `groovy.noRoot` (Experimental): Enables language server features for standalone Groovy files (for when no Maven or Gradle project root is available). Set this in the global CoC configuration. Default: `false`

## Setting the JDK

The path to the Java Development Kit is searched in the following order:

1. The `groovy.java.home` setting in coc.nvim settings (workspace then user settings).
2. The `JDK_HOME` environment variable.
3. The `JAVA_HOME` environment variable.
4. The current system path.

## License

EPL 2.0, See [LICENSE](LICENSE) for more information.

[0]: https://maven.apache.org/wrapper/
[1]: https://maven.apache.org/install.html
