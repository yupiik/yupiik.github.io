import { h, Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { generateFiles } from './generateFiles';
import JSZip from 'jszip';
import FileSaver from 'file-saver';

const compareChildren = (c1, c2) => {
    if (!c1.children && c2.children) {
        return 1;
    }
    if (c1.children && !c2.children) {
        return -1;
    }
    return c1.name.localeCompare(c2.name);
};

const SimpleLi = ({ children, key, onClick }) => (
    <li key={key} style={{ listStyleType: 'none' }} onClick={onClick}>{children}</li>
);

const Item = ({ item, setSelectedFile }) => (
    <>
        {item.children && <Folder folder={item} setSelectedFile={setSelectedFile} />}
        {!item.children && <File file={item} setSelectedFile={setSelectedFile} />}
    </>
);

const mergeSingleLevelFolders = folder => {
    let current = { ...folder };
    while (current.children.length == 1 && current.children[0].children) {
        current = { key: folder.key, name: `${current.name}/${current.children[0].name}`, children: current.children[0].children }
    }
    return current;
};

const Folder = ({ folder, setSelectedFile }) => {
    const [opened, setOpened] = useState(false);
    const internalFolder = mergeSingleLevelFolders(folder);
    const item = (
        <span onClick={() => {
            setOpened(!opened);
            setSelectedFile(null);
        }}>
            <i className={`mr-1 ${findFileIcon(folder.name, () => `far fa-folder${opened ? '-open' : ''}`)}`}></i>
            {internalFolder.name} <span style={{ verticalAlign: 'super', fontSize: 'xx-small' }}>({internalFolder.children.length})</span>
        </span>
    );
    return (
        <>
            {!opened &&
                <SimpleLi key={item.key}>{item}</SimpleLi>}
            {opened &&
                <SimpleLi key={item.key}>
                    {item}
                    <ul className="nested" key={internalFolder.id} style={{ marginLeft: '0.5rem' }}>
                        {internalFolder.children.sort(compareChildren).map(it => (<Item item={it} setSelectedFile={setSelectedFile} />))}
                    </ul>
                </SimpleLi>}
        </>
    );
};

const findFileIcon = (name, fallback) => {
    if (name == 'java' || name.startsWith('java/')) {
        return 'fas fa-code';
    }
    if (name.endsWith('.java') || name.endsWith('.json') || name.endsWith('.xml')) {
        return 'far fa-file-code';
    }
    if (name.endsWith('.js')) {
        return 'fab fa-js';
    }
    if (name.endsWith('.adoc')) {
        return 'fa fa-book';
    }
    return fallback();
};

const File = ({ file, setSelectedFile }) => (
    <SimpleLi key={file.id} onClick={() => setSelectedFile(file)}>
        <i className={`mr-1 far ${findFileIcon(file.name, () => 'far fa-file-alt')}`}></i>
        {file.name}
    </SimpleLi>
);


const findHighlightClass = file => {
    if (!file) {
        return 'nohighlight';
    }
    if (file.name.endsWith('.xml')) {
        return 'language-xml';
    }
    if (file.name.endsWith('.java')) {
        return 'language-java';
    }
    if (file.name.endsWith('.properties')) {
        return 'language-properties';
    }
    if (file.name.endsWith('.json')) {
        return 'language-json';
    }
    if (file.name.endsWith('.js')) {
        return 'language-javascript';
    }
    if (file.name.endsWith('.adoc')) {
        return 'language-asciidoc';
    }
    if (file.name == '.gitignore') {
        return 'language-bash';
    }
    if (file.name.endsWith('.css')) {
        return 'language-css';
    }
    if (file.name.endsWith('.html')) {
        return 'language-html';
    }
    return 'nohighlight';
};

const doZip = (parent, file) => {
    if (file.children) {
        const folder = parent.folder(file.name);
        file.children.forEach(it => doZip(folder, it));
    } else {
        parent.file(file.name, file.content);
    }
};
const downloadZip = (data, files) => {
    const zip = new JSZip();
    doZip(zip, { name: data.nav.artifactId, children: files });
    zip
        .generateAsync({ type: 'blob' })
        .then(content => FileSaver.saveAs(content, `${data.nav.artifactId || 'project'}-${data.nav.version || '1.0.0-SNAPSHOT'}.zip`));
};

const Code = ({ file }) => {
    const ref = useRef();
    useEffect(() => {
        if (ref.current && window.hljs) {
            window.hljs.highlightElement(ref.current);
        }
    }, [file]);
    return (
        <code key={file.name} ref={ref} className={findHighlightClass(file)}>
            {file.content}
        </code>
    );
};

export const GeneratedProject = ({ dispatch, data }) => {
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    useEffect(() => {
        setFiles(generateFiles(data));
        setSelectedFile(null);
    }, [data]);
    return (
        <>
            <h3 className="mt-3">Skeleton Project Files</h3>
            <div className="col-sm-12 row">
                <div className="col-sm-4" style={{ overflowX: 'auto' }}>
                    <div>
                        <button type="button" className="btn btn-outline-primary" onClick={() => downloadZip(data, files)}>
                            <i className="fa fa-file-archive mr-1" />
                            Download Project
                        </button>
                    </div>
                    <ul style={{ marginLeft: 0 }}>
                        {files.sort(compareChildren).map(it => <Item item={it} setSelectedFile={setSelectedFile} />)}
                    </ul>
                </div>
                <div className="col-sm-8">
                    {selectedFile && selectedFile.content && <pre>
                        <Code file={selectedFile} />
                    </pre>}
                </div>
            </div>
        </>
    );
};
