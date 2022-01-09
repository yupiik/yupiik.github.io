import { h } from 'preact';

const Input = ({ name, dispatch, data }) => {
    const label = `${name.substring(0, 1).toUpperCase()}${name.substring(1)}`;
    return (
        <div className="form-group row" style={{ marginBottom: '0.3rem' }}>
            <label for={name} className="col-sm-2">
                <b>{label}</b>
            </label>
            <div className="col-sm-10">
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
            <div className="row">
                <h3>Metadata</h3>
            </div>
            <div>
                <form>
                    <div className="form-group row">
                        <div className="col-sm-6">
                            <b>Java Version</b>
                        </div>
                        <div className="col-sm-6">
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
