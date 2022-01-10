import { h } from 'preact';

const Input = ({ name, dispatch, data }) => {
    const label = `${name.substring(0, 1).toUpperCase()}${name.substring(1)}`;
    return (
        <div className="form-group" style={{ marginBottom: '0.3rem', marginRight: '1rem', flex: '1' }}>
            <label for={name}>
                <b>{label}</b>
            </label>
            <div>
                <input
                    id={name}
                    value={data[name]}
                    onChange={e => dispatch({
                        type: `nav.${name}`,
                        value: e.target.value,
                    })}
                    className="col-sm-12 form-control form-control-sm"
                    placeholder={`${label}...`}
                />
            </div>
        </div>
    );
};

export const Nav = ({ data, dispatch }) => {
    return (
        <div>
            <div>
                <h3>Metadata</h3>
            </div>
            <div>
                <form style={{ display: 'flex' }}>
                    <div className="form-group" style={{ flex: '1' }}>
                        <div>
                            <b>Java Version</b>
                        </div>
                        <div>
                            <div className="form-check">
                                <input
                                    type="radio"
                                    className="form-check-input"
                                    checked={data.javaVersion == '17'}
                                    onChange={e => dispatch({
                                        type: 'nav.javaVersion',
                                        value: parseInt(e.target.value),
                                    })}
                                    id="javaVersion"
                                    value={data.javaVersion}
                                    aria-describedby="javaVersion"
                                    placeholder="Java Version" />
                                <label
                                    for="javaVersion"
                                    className="form-check-label">
                                    17
                                </label>
                            </div>
                        </div>
                    </div>
                    <Input name="groupId" dispatch={dispatch} data={data} />
                    <Input name="artifactId" dispatch={dispatch} data={data} />
                    <Input name="version" dispatch={dispatch} data={data} />
                </form>
            </div>
        </div>
    );
};
