export const defaultState = {
    nav: {
        javaVersion: 17,
        groupId: 'org.example',
        artifactId: 'application',
        version: '1.0.0-SNAPSHOT',
    },
    features: {
        jsonRpc: {
            label: 'JSON-RPC',
            order: 1,
            enabled: true,
            supportSubModule: true,
            useParent: false,
            tooltip: 'Enables JSON-RPC backend',
            icon: 'fa fa-server',
            switchValues: [
                { name: 'useFusion', enabled: true, label: 'Use Fusion', tooltip: 'Backend will use Fusion IoC/JSON-RPC server if checked else a CDI IoC with uShip JSON-RPC server' },
                { name: 'useUship', enabled: false },
            ],
        },
        frontend: {
            label: 'Frontend',
            order: 2,
            enabled: false,
            supportSubModule: true,
            useParent: false,
            tooltip: 'Enables Preact/ESBuild',
            icon: 'fab fa-js',
        },
        batch: {
            label: 'Batch',
            order: 3,
            enabled: false,
            supportSubModule: true,
            useParent: false,
            tooltip: 'Enables Yupiik Batch',
            icon: 'fa fa-dumbbell',
        },
        kubernetesClient: {
            label: 'K8s Client',
            order: 4,
            enabled: false,
            supportSubModule: false,
            useParent: false,
            tooltip: 'Creates a K8s HTTP Client in the backend',
            icon: 'fa fa-cloud',
        },
        jib: {
            label: 'JIB (docker)',
            order: 5,
            enabled: false,
            supportSubModule: false,
            useParent: false,
            tooltip: 'Setup docker image creation',
            icon: 'fab fa-docker',
        },
        bundlebee: {
            label: 'BundleBee',
            order: 6,
            enabled: false,
            supportSubModule: false,
            useParent: false,
            tooltip: 'Create a (Kubernetes) bundlebee deployment recipe',
            icon: 'fa fa-network-wired',
        },
        documentation: {
            label: 'Minisite',
            order: 7,
            enabled: false,
            supportSubModule: false,
            useParent: false,
            tooltip: 'Setup a documentation module for the project',
            icon: 'fa fa-book',
        },
        github: {
            label: 'Github',
            order: 8,
            enabled: false,
            supportSubModule: false,
            useParent: false,
            tooltip: 'Generate a basic Github Workflow',
            icon: 'fab fa-github',
        },
        // todo: add httpclient (not k8s one), add persistence (so tomcat-jdbc+persistence with h2 and pg) etc...
    },
};
