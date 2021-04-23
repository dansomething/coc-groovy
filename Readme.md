# coc-groovy

An [extension for coc.nvim](https://github.com/neoclide/coc.nvim/wiki/Using-coc-extensions) to enable
[Groovy language server](https://github.com/prominic/groovy-language-server) support.

## Quick Start

1. Download and install a recent Java Development Kit (latest Java 8 is the minimum requirement).
2. Install this extension by running this command in Vim:
```
  :CocInstall coc-groovy
```
3. This extension is activated when you first open a Groovy file.

## Features

- Code Completion
- Find References
- Go to Definition
- Highlights
- Refactor Rename
- Signature Hover

## Available commands

The following coc.nvim commands are available:

- `groovy.project.config.update` : This is available when the editor is focused on a Groovy file. It forces project configuration/classpath updates (eg. dependency changes) according to the project build descriptor.

## Supported settings

The following settings are supported:

- `groovy.java.home` : The absolute path to the JDK 8+ home directory. This is used to launch the Groovy language server. Requires a coc server restart.
- `groovy.ls.vmargs` : Extra Java VM arguments used to launch the Groovy language server. Requires a coc server restart.
- `groovy.ls.home` : The absolute path to the Groovy language server. This would be used instead of the bundled server when specified.
- `groovy.project.referencedLibraries` : Configure additional paths (jar file or directory) for referencing libraries in a Groovy project.
- `groovy.trace.server` : Traces the communication between the coc-groovy extension and the Groovy language server.

## Setting the JDK

The path to the Java Development Kit is searched in the following order:

1. The `groovy.java.home` setting in coc.nvim settings (workspace then user settings).
2. The `JDK_HOME` environment variable.
3. The `JAVA_HOME` environment variable.
4. The current system path.

## Gradle Support

By default coc-groovy will try to run with maven and look for a `pom.xml` in the project root, however if `build.gradle` is found coc-groovy will attempt to resolve classes from there.

`gradlew` or `gradle.bat` will be used over the `gradle` command if found.

Currently there is no built in way in gradle to generate a classpath like there is in maven, so we have to add it ourselves.

To use gradle with coc-groovy, add this task to your `build.gradle`

```groovy
tasks.register("classPath"){
    def classpath = sourceSets.main.compileClasspath.asPath 
    if(System.getProperty("outputFile") != ""){
        File out =  new File(outputFile)
        out.getParentFile().mkdirs()
        out.text = classpath
    }
    else
        println classpath
}
```

coc-groovy will execute this command

`${gradleCmd} classPath -PoutputFile=${classpathFilePath}`

Make sure this works on your machine after adding the task

Example: `./gradlew classPath` or `./gradlew classPath -PoutputFile=cp.txt`

## License

EPL 2.0, See [LICENSE](LICENSE) for more information.
